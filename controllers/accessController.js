import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Role from '../models/Role.js';
import AdminUser from '../models/AdminUser.js';
import { ADMIN_PAGES, OWNER_KEY, isKnownPage, canGrantPages } from '../config/adminPages.js';
import { canManageRole, canManageUser, targetAccess, isLastActiveOwner } from '../services/access.js';
import { HttpError } from '../utils/httpError.js';
import { cleanText, escapeRegex } from '../utils/strings.js';
import { emailOk } from '../utils/validators.js';
import { MIN_PASSWORD_LENGTH } from './authController.js';
import { sealPassword, openPassword } from '../services/passwordVault.js';

// Roles and users for the admin panel. Every rule that stops someone from giving away more access than they
// have is checked here on the server, so hiding a button in the screen is never the only protection.

const invalid = (errors) => {
  if (Object.keys(errors).length) throw new HttpError(400, 'Please check the highlighted fields.', errors);
};
const readPassword = (value) => (typeof value === 'string' ? value.slice(0, 200) : '');
const isOwnerRole = (role) => role?.key === OWNER_KEY;
const cleanPages = (value) =>
  [...new Set(Array.isArray(value) ? value.filter((p) => typeof p === 'string') : [])].filter(isKnownPage);
const sameName = (name, excludeId) => ({
  name: new RegExp(`^${escapeRegex(name)}$`, 'i'),
  ...(excludeId ? { _id: { $ne: excludeId } } : {}),
});

const roleView = (role, counts, actor) => ({
  _id: String(role._id),
  name: role.name,
  description: role.description || '',
  pages: role.pages || [],
  isSystem: Boolean(role.isSystem),
  users: counts.users || 0,
  activeUsers: counts.activeUsers || 0,
  canManage: canManageRole(actor, role),
});

const userView = (user, role, actor) => ({
  _id: String(user._id),
  name: user.name,
  email: user.email,
  active: user.active !== false,
  lastLoginAt: user.lastLoginAt || null,
  createdAt: user.createdAt,
  role: role ? { _id: String(role._id), name: role.name, isSystem: Boolean(role.isSystem) } : null,
  isSelf: String(user._id) === actor.id,
  canManage: String(user._id) !== actor.id && canManageUser(actor, targetAccess(role)),
});

async function userCounts() {
  const rows = await AdminUser.aggregate([
    { $match: { roleId: { $ne: null } } },
    {
      $group: {
        _id: '$roleId',
        users: { $sum: 1 },
        activeUsers: { $sum: { $cond: [{ $ne: ['$active', false] }, 1, 0] } },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), { users: r.users, activeUsers: r.activeUsers }]));
}

// GET /api/admin/access/pages. The list of pages for the role editor. `grantable` says whether this admin may give it.
export function listPages(req, res) {
  res.json({
    ok: true,
    pages: ADMIN_PAGES.map(({ id, label, group }) => ({
      id,
      label,
      group,
      grantable: canGrantPages(req.admin, [id]),
    })),
  });
}

// GET /api/admin/roles
export async function listRoles(req, res) {
  const [roles, counts] = await Promise.all([Role.find().sort({ isSystem: -1, name: 1 }).lean(), userCounts()]);
  res.json({
    ok: true,
    items: roles.map((r) => roleView(r, counts.get(String(r._id)) || {}, req.admin)),
  });
}

// POST /api/admin/roles  { name, description, pages }
export async function createRole(req, res) {
  const actor = req.admin;
  const name = cleanText(req.body?.name, 60);
  const description = cleanText(req.body?.description, 200);
  const pages = cleanPages(req.body?.pages);

  const errors = {};
  if (!name) errors.name = 'Enter a name for this role.';
  else if (name.toLowerCase() === OWNER_KEY) errors.name = 'This name is reserved. Choose another name.';
  else if (await Role.exists(sameName(name))) errors.name = 'A role with this name already exists.';
  if (!pages.length) errors.pages = 'Choose at least one page this role can open.';
  else if (!canGrantPages(actor, pages)) errors.pages = 'You can only give pages that you can open yourself.';
  invalid(errors);

  const role = await Role.create({ name, description, pages });
  res.status(201).json({ ok: true, item: roleView(role.toObject(), {}, actor) });
}

// PATCH /api/admin/roles/:id
export async function updateRole(req, res) {
  const actor = req.admin;
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Not found.');
  const role = await Role.findById(req.params.id);
  if (!role) throw new HttpError(404, 'Not found.');
  if (isOwnerRole(role)) throw new HttpError(400, 'The Owner role always has every page, so it cannot be changed.');
  if (!canManageRole(actor, role)) {
    throw new HttpError(403, 'You cannot change this role, because it has pages that you cannot open yourself.');
  }

  const body = req.body || {};
  const errors = {};
  const data = {};
  if (body.name !== undefined) {
    const name = cleanText(body.name, 60);
    if (!name) errors.name = 'Enter a name for this role.';
    else if (name.toLowerCase() === OWNER_KEY) errors.name = 'This name is reserved. Choose another name.';
    else if (await Role.exists(sameName(name, role._id))) errors.name = 'A role with this name already exists.';
    else data.name = name;
  }
  if (body.description !== undefined) data.description = cleanText(body.description, 200);
  if (body.pages !== undefined) {
    const pages = cleanPages(body.pages);
    if (!pages.length) errors.pages = 'Choose at least one page this role can open.';
    else if (!canGrantPages(actor, pages)) errors.pages = 'You can only give pages that you can open yourself.';
    else data.pages = pages;
  }
  invalid(errors);

  role.set(data);
  await role.save();
  res.json({ ok: true, item: roleView(role.toObject(), {}, actor) });
}

// DELETE /api/admin/roles/:id. A role that people still use cannot be deleted.
export async function deleteRole(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Not found.');
  const role = await Role.findById(req.params.id);
  if (!role) throw new HttpError(404, 'Not found.');
  if (isOwnerRole(role) || role.isSystem) throw new HttpError(400, 'The Owner role cannot be deleted.');
  if (!canManageRole(req.admin, role)) {
    throw new HttpError(403, 'You cannot delete this role, because it has pages that you cannot open yourself.');
  }
  const users = await AdminUser.countDocuments({ roleId: role._id });
  if (users) {
    throw new HttpError(409, `${users} ${users === 1 ? 'person uses' : 'people use'} this role. Move them to another role first.`);
  }
  await role.deleteOne();
  res.json({ ok: true });
}

// GET /api/admin/users
export async function listUsers(req, res) {
  const actor = req.admin;
  const [users, roles] = await Promise.all([
    AdminUser.find().select('name email active lastLoginAt createdAt roleId').sort({ createdAt: 1 }).lean(),
    Role.find().select('name key pages isSystem').lean(),
  ]);
  const byId = new Map(roles.map((r) => [String(r._id), r]));
  res.json({
    ok: true,
    items: users.map((u) => userView(u, byId.get(String(u.roleId)) || null, actor)),
  });
}

// POST /api/admin/users  { name, email, password, roleId, active }
export async function createUser(req, res) {
  const actor = req.admin;
  const body = req.body || {};
  const name = cleanText(body.name, 100);
  const email = cleanText(body.email, 254).toLowerCase();
  const password = readPassword(body.password);
  const roleId = typeof body.roleId === 'string' ? body.roleId : '';
  const active = body.active !== false;

  const errors = {};
  if (!name) errors.name = "Enter the person's name.";
  if (!emailOk(email)) errors.email = 'Enter a valid email address. This is what the person signs in with.';
  else if (await AdminUser.exists({ email })) errors.email = 'Another account already uses this email address.';
  if (password.length < MIN_PASSWORD_LENGTH) errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  const role = mongoose.isValidObjectId(roleId) ? await Role.findById(roleId).lean() : null;
  if (!role) errors.roleId = 'Choose a role for this person.';
  else if (isOwnerRole(role) && !actor.isOwner) errors.roleId = 'Only the Owner can give the Owner role.';
  else if (!canGrantPages(actor, role.pages)) {
    errors.roleId = 'You cannot give this role, because it has pages that you cannot open yourself.';
  }
  invalid(errors);

  const user = await AdminUser.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, 12),
    passwordVault: sealPassword(password),
    roleId: role._id,
    active,
  });
  res.status(201).json({ ok: true, item: userView(user.toObject(), role, actor) });
}

// PATCH /api/admin/users/:id. Used for the edit popup, the on/off switch and resetting a password.
export async function updateUser(req, res) {
  const actor = req.admin;
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Not found.');
  const user = await AdminUser.findById(req.params.id);
  if (!user) throw new HttpError(404, 'Not found.');

  const body = req.body || {};
  const isSelf = String(user._id) === actor.id;
  const currentRole = user.roleId ? await Role.findById(user.roleId).lean() : null;
  const wasActive = user.active !== false;

  const roleChanged = body.roleId !== undefined && String(body.roleId) !== String(user.roleId || '');
  const activeChanged = body.active !== undefined && (body.active !== false) !== wasActive;
  if (isSelf && (roleChanged || activeChanged)) {
    throw new HttpError(400, 'You cannot change the role or turn off the account you are signed in with. Ask another administrator.');
  }
  if (!isSelf && !canManageUser(actor, targetAccess(currentRole))) {
    throw new HttpError(403, 'You cannot change this account, because it has pages that you cannot open yourself.');
  }

  const errors = {};
  const data = {};
  if (body.name !== undefined) {
    const name = cleanText(body.name, 100);
    if (!name) errors.name = "Enter the person's name.";
    else data.name = name;
  }
  if (body.email !== undefined) {
    const email = cleanText(body.email, 254).toLowerCase();
    if (!emailOk(email)) errors.email = 'Enter a valid email address. This is what the person signs in with.';
    else if (await AdminUser.exists({ email, _id: { $ne: user._id } })) {
      errors.email = 'Another account already uses this email address.';
    } else data.email = email;
  }

  let nextRole = currentRole;
  if (roleChanged) {
    const role = mongoose.isValidObjectId(body.roleId) ? await Role.findById(body.roleId).lean() : null;
    if (!role) errors.roleId = 'Choose a role for this person.';
    else if (isOwnerRole(role) && !actor.isOwner) errors.roleId = 'Only the Owner can give the Owner role.';
    else if (!canGrantPages(actor, role.pages)) {
      errors.roleId = 'You cannot give this role, because it has pages that you cannot open yourself.';
    } else {
      data.roleId = role._id;
      nextRole = role;
    }
  }

  const nextActive = body.active !== undefined ? body.active !== false : wasActive;
  if (body.active !== undefined) data.active = nextActive;

  const password = readPassword(body.password);
  if (password) {
    if (password.length < MIN_PASSWORD_LENGTH) errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    else {
      data.passwordHash = await bcrypt.hash(password, 12);
      data.passwordVault = sealPassword(password);
    }
  }
  invalid(errors);

  // The last active Owner must stay active and stay an Owner, or nobody could manage the panel any more.
  const losesOwner = wasActive && isOwnerRole(currentRole) && (!isOwnerRole(nextRole) || !nextActive);
  if (losesOwner && (await isLastActiveOwner(user._id))) {
    throw new HttpError(400, 'This is the only active Owner. Make another person an Owner first.');
  }

  user.set(data);
  await user.save();
  res.json({ ok: true, item: userView(user.toObject(), nextRole, actor) });
}

// DELETE /api/admin/users/:id
export async function deleteUser(req, res) {
  const actor = req.admin;
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Not found.');
  const user = await AdminUser.findById(req.params.id);
  if (!user) throw new HttpError(404, 'Not found.');
  if (String(user._id) === actor.id) throw new HttpError(400, 'You cannot delete the account you are signed in with.');

  const role = user.roleId ? await Role.findById(user.roleId).lean() : null;
  if (!canManageUser(actor, targetAccess(role))) {
    throw new HttpError(403, 'You cannot delete this account, because it has pages that you cannot open yourself.');
  }
  if (isOwnerRole(role) && user.active !== false && (await isLastActiveOwner(user._id))) {
    throw new HttpError(400, 'This is the only active Owner. Make another person an Owner first.');
  }
  await user.deleteOne();
  res.json({ ok: true });
}

// GET /api/admin/users/:id/password. Shows the current password to someone who may manage this account (the Owner
// by default). Passwords set before this feature have no copy, so the screen asks for a new one.
export async function revealPassword(req, res) {
  const actor = req.admin;
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Not found.');
  const user = await AdminUser.findById(req.params.id).select('+passwordVault').lean();
  if (!user) throw new HttpError(404, 'Not found.');
  if (String(user._id) !== actor.id) {
    const role = user.roleId ? await Role.findById(user.roleId).lean() : null;
    if (!canManageUser(actor, targetAccess(role))) {
      throw new HttpError(403, 'You cannot see the password of this account, because it has pages that you cannot open yourself.');
    }
  }
  const password = openPassword(user.passwordVault);
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, available: Boolean(password), password: password || '' });
}
