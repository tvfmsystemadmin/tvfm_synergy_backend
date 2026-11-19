import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { HttpError } from '../utils/httpError.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_ROOT = path.resolve(here, '..', 'uploads');
export const TMP_DIR = path.join(UPLOAD_ROOT, '.tmp');

export const KINDS = {
  image: {
    maxBytes: 8 * 1024 * 1024,
    mimes: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' },
  },
  video: {
    maxBytes: 200 * 1024 * 1024,
    mimes: { 'video/mp4': 'mp4', 'video/webm': 'webm' },
  },
};

// PDF files used as email attachments (see controllers/thankYouController.js). Kept apart from the image and video library.
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export const FOLDERS = [
  'hero', 'brands', 'pos-videos', 'pos-modules', 'testimonials',
  'products', 'combos', 'services', 'blogs', 'misc', 'avatars',
];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    cb(null, TMP_DIR);
  },
  filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}.part`),
});

const uploaders = {};

function uploaderFor(kind) {
  if (!uploaders[kind]) {
    const { maxBytes, mimes } = KINDS[kind];
    uploaders[kind] = multer({
      storage,
      limits: { fileSize: maxBytes, files: 1 },
      fileFilter: (_req, file, cb) => {
        if (!Object.prototype.hasOwnProperty.call(mimes, file.mimetype)) {
          return cb(new HttpError(415, 'This file type is not allowed.'));
        }
        return cb(null, true);
      },
    }).single('file');
  }
  return uploaders[kind];
}

// Reads ?kind=image|video&folder=<name>, then stores one file in a temporary folder.
// The controller checks the file content before moving it into place.
export function uploadSingle(req, res, next) {
  const kind = typeof req.query.kind === 'string' ? req.query.kind : '';
  const folder = typeof req.query.folder === 'string' ? req.query.folder : 'misc';
  if (!Object.prototype.hasOwnProperty.call(KINDS, kind)) return next(new HttpError(400, 'Choose image or video.'));
  if (!FOLDERS.includes(folder)) return next(new HttpError(400, 'Unknown upload folder.'));
  req.uploadKind = kind;
  req.uploadFolder = folder;
  return uploaderFor(kind)(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, 'The file is too large for this upload.'));
    return next(err);
  });
}

const documentUploader = multer({
  storage,
  limits: { fileSize: DOCUMENT_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new HttpError(415, 'Upload a PDF file.'));
    return cb(null, true);
  },
}).single('file');

// Reads one PDF upload into a temporary file. The controller checks the content before keeping it.
export function uploadDocument(req, res, next) {
  return documentUploader(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, 'The PDF is too large. Keep it under 10 MB.'));
    return next(err);
  });
}
