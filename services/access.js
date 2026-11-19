import AdminUser from '../models/AdminUser.js';
import Role from '../models/Role.js';
import { ADMIN_PAGES, ALL_PAGE_IDS, OWNER_KEY } from '../config/adminPages.js';

export const OWNER_ROLE_NAME = 'Owner';

// Who is signed in and which pages they may open. Login, the session check and every admin request use this.
// Returns null when the account does not exist or is turned off.
export async function accessFor(userId) {
  const user = await AdminUser.findById(userId).select('email name roleId active avatarUrl').lean();
  if (!user || user.active === false) return null;

  const role = user.roleId ? await Role.findById(user.roleId).select('name key pages description').lean() : null;
  const isOwner = role?.key === OWNER_KEY;
  const pages = isOwner ? ALL_PAGE_IDS : (role?.pages || []).filter((p) => ALL_PAGE_IDS.includes(p));

  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl || '',
    isOwner,
    pages,
    // The pages with their names and groups, for My account.
    pageItems: ADMIN_PAGES.filter((p) => pages.includes(p.id)).map(({ id, label, group }) => ({ id, label, group })),
    role: role ? { id: String(role._id), name: role.name, description: role.description || '', isOwner } : null,
  };
}

// Creates or refreshes the Owner role. Its page list always matches the code, so a new page is added on restart.
export async function ensureOwnerRole() {
  return Role.findOneAndUpdate(
    { key: OWNER_KEY },
    {
      $set: {
        name: OWNER_ROLE_NAME,
        description: 'Full access to every page, including roles and users. This role cannot be changed.',
        pages: ALL_PAGE_IDS,
        isSystem: true,
      },
    },
    { upsert: true, new: true },
  );
}

// Runs on every start. Accounts without a role (from before roles existed) become Owners, so nobody loses access.
export async function ensureAccessSetup() {
  const owner = await ensureOwnerRole();
  await AdminUser.updateMany({ roleId: null }, { $set: { roleId: owner._id } });
  return owner;
}

export async function ownerRoleId() {
  const owner = await Role.findOne({ key: OWNER_KEY }).select('_id').lean();
  return owner?._id || null;
}

// The shape canManageUser and canManageRole check. `role` is a lean Role document or null.
export const targetAccess = (role) => ({
  isOwner: role?.key === OWNER_KEY,
  pages: role?.key === OWNER_KEY ? ALL_PAGE_IDS : role?.pages || [],
});

// Can this admin change or delete this account? The Owner can change anyone. Others only accounts whose pages
// they can already open, and never the Owner.
export function canManageUser(actor, target) {
  if (actor.isOwner) return true;
  if (target.isOwner) return false;
  return target.pages.every((p) => actor.pages.includes(p));
}

// Can this admin change this role? The Owner role never changes. Others only roles whose pages they can open.
export function canManageRole(actor, role) {
  if (role.isSystem || role.key === OWNER_KEY) return false;
  if (actor.isOwner) return true;
  return (role.pages || []).every((p) => actor.pages.includes(p));
}

// Stops the last active Owner from being turned off, deleted or demoted, so the panel always has someone in charge.
export async function isLastActiveOwner(userId) {
  const ownerId = await ownerRoleId();
  if (!ownerId) return false;
  const others = await AdminUser.countDocuments({
    roleId: ownerId,
    active: { $ne: false },
    _id: { $ne: userId },
  });
  return others === 0;
}

// Email addresses that receive password codes: every active Owner. The account's own address is used only
// when no Owner exists yet (a fresh installation).
export async function adminRecipients(fallbackEmail) {
  const ownerId = await ownerRoleId();
  const owners = ownerId ? await AdminUser.find({ roleId: ownerId, active: { $ne: false } }).select('email').lean() : [];
  const emails = owners.map((o) => o.email).filter(Boolean);
  return emails.length ? emails : [fallbackEmail].filter(Boolean);
}
