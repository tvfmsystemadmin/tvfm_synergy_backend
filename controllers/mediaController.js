import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Media from '../models/Media.js';
import { HttpError } from '../utils/httpError.js';
import { detectMime } from '../utils/fileSignature.js';
import { cleanText, escapeRegex } from '../utils/strings.js';
import { UPLOAD_ROOT, KINDS, FOLDERS } from '../middleware/upload.js';
import { RESOURCES } from '../config/resources.js';
import SiteSettings from '../models/SiteSettings.js';
import ContactInfo from '../models/ContactInfo.js';
import ThankYouEmail from '../models/ThankYouEmail.js';

// Upload addresses as they are stored (for example /uploads/products/<id>.webp).
const UPLOAD_RE = /\/uploads\/[a-z-]+\/[A-Za-z0-9-]+\.(?:webp|png|jpe?g|gif|mp4|webm|pdf)/gi;

// Every upload address that any saved content mentions. One read of each collection, so the library can tell
// which files are in use before anything is deleted.
export async function usedUploadUrls() {
  const models = [...RESOURCES.map((cfg) => cfg.model), SiteSettings, ContactInfo, ThankYouEmail];
  const urls = new Set();
  for (const model of models) {
    const docs = await model.find({}).lean();
    for (const doc of docs) {
      for (const match of JSON.stringify(doc).matchAll(UPLOAD_RE)) urls.add(match[0]);
    }
  }
  return urls;
}

async function readHead(file) {
  const handle = await fs.promises.open(file, 'r');
  try {
    const buffer = Buffer.alloc(32);
    const { bytesRead } = await handle.read(buffer, 0, 32, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

// Stores one uploaded file after checking its content matches the declared type.
export async function uploadMedia(req, res) {
  const file = req.file;
  if (!file) throw new HttpError(400, 'Choose a file to upload.');
  const { uploadKind: kind, uploadFolder: folder } = req;
  let finalPath = null;
  try {
    const detected = detectMime(await readHead(file.path));
    const ext = detected ? KINDS[kind].mimes[detected] : undefined;
    if (!ext || detected !== file.mimetype) {
      throw new HttpError(415, 'The file content does not match its type. Upload a real image or video.');
    }
    const dir = path.join(UPLOAD_ROOT, folder);
    await fs.promises.mkdir(dir, { recursive: true });
    const storedName = `${crypto.randomUUID()}.${ext}`;
    finalPath = path.join(dir, storedName);
    await fs.promises.rename(file.path, finalPath);
    const media = await Media.create({
      url: `/uploads/${folder}/${storedName}`,
      kind,
      folder,
      storedName,
      mime: detected,
      size: file.size,
      originalName: cleanText(file.originalname, 200),
      uploadedBy: req.admin?.email || '',
    });
    return res.status(201).json({ ok: true, media });
  } catch (err) {
    await fs.promises.rm(file.path, { force: true }).catch(() => {});
    if (finalPath) await fs.promises.rm(finalPath, { force: true }).catch(() => {});
    throw err;
  }
}

// GET /api/admin/media?folder=&kind=&use=used|unused. Each file says whether saved content still uses it.
export async function listMedia(req, res) {
  const filter = {};
  const folder = cleanText(req.query.folder, 40);
  if (FOLDERS.includes(folder)) filter.folder = folder;
  const kind = cleanText(req.query.kind, 10);
  if (kind === 'image' || kind === 'video') filter.kind = kind;
  const [rows, used] = await Promise.all([Media.find(filter).sort({ createdAt: -1 }).lean(), usedUploadUrls()]);
  let items = rows.map((m) => ({ ...m, inUse: used.has(m.url) }));
  const use = cleanText(req.query.use, 10);
  if (use === 'used') items = items.filter((m) => m.inUse);
  if (use === 'unused') items = items.filter((m) => !m.inUse);
  res.json({ ok: true, items: items.slice(0, 500) });
}

// GET /api/admin/media/summary. Totals for the storage box: how many files, how much space, and how much of it
// is not used by any content (safe to delete).
export async function mediaSummary(req, res) {
  const [rows, used] = await Promise.all([Media.find({}).select('url folder size').lean(), usedUploadUrls()]);
  const folders = new Map();
  let bytes = 0;
  let unusedCount = 0;
  let unusedBytes = 0;
  for (const m of rows) {
    bytes += m.size || 0;
    const f = folders.get(m.folder) || { folder: m.folder, count: 0, bytes: 0 };
    f.count += 1;
    f.bytes += m.size || 0;
    folders.set(m.folder, f);
    if (!used.has(m.url)) {
      unusedCount += 1;
      unusedBytes += m.size || 0;
    }
  }
  res.json({
    ok: true,
    total: { count: rows.length, bytes },
    unused: { count: unusedCount, bytes: unusedBytes },
    folders: [...folders.values()].sort((a, b) => b.bytes - a.bytes),
  });
}

// Lists the content types that still point at this file (any text field, or the blog HTML).
async function usedIn(url) {
  const names = [];
  for (const cfg of RESOURCES) {
    const schema = cfg.model.schema;
    const or = Object.entries(schema.paths)
      .filter(([name, type]) => {
        if (name === '_id' || name.includes('.')) return false;
        return type.instance === 'String' || (type.instance === 'Array' && type.caster?.instance === 'String');
      })
      .map(([name]) => ({ [name]: url }));
    if (schema.path('contentHtml')) or.push({ contentHtml: { $regex: escapeRegex(url) } });
    if (or.length && (await cfg.model.exists({ $or: or }))) names.push(cfg.name);
  }
  return names;
}

// Deleting a file that content still uses leaves broken images on the website. Refuse unless forced.
export async function deleteMedia(req, res) {
  const media = await Media.findById(req.params.id);
  if (!media) throw new HttpError(404, 'File not found.');
  const target = path.resolve(UPLOAD_ROOT, media.folder, media.storedName);
  if (!target.startsWith(UPLOAD_ROOT + path.sep)) throw new HttpError(400, 'Invalid file.');
  const places = await usedIn(media.url);
  if (places.length && req.query.force !== '1') {
    throw new HttpError(409, 'This file is still used on the website. Remove it there first, or delete it anyway.', {
      usedIn: places,
    });
  }
  await fs.promises.rm(target, { force: true });
  await media.deleteOne();
  res.json({ ok: true });
}
