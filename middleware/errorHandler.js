import { HttpError } from '../utils/httpError.js';

export function notFound(req, res) {
  res.status(404).json({ ok: false, error: 'Not found.' });
}

// Every API error becomes JSON with a safe message. Internal details are logged on the server only.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      ok: false,
      error: err.message,
      ...(err.errors ? { errors: err.errors } : {}),
    });
  }
  if (err.type === 'entity.too.large' || err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ ok: false, error: 'The file or request is too large.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: 'Could not read the request. Please try again.' });
  }
  if (err.name === 'MulterError') {
    return res.status(400).json({ ok: false, error: 'The upload could not be processed.' });
  }
  if (err.name === 'ValidationError') {
    const errors = {};
    for (const [field, detail] of Object.entries(err.errors || {})) {
      errors[field.split('.')[0]] = detail.message;
    }
    return res.status(400).json({ ok: false, error: 'Please check the highlighted fields.', errors });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ ok: false, error: 'One of the values is not valid.' });
  }
  if (err.code === 11000) {
    return res.status(409).json({ ok: false, error: 'An item with this value already exists.' });
  }
  // The database is down or still starting. Say so plainly instead of a generic server error.
  if (isDatabaseDown(err)) {
    console.error(`[api] ${req.method} ${req.originalUrl}: database unavailable (${err.message})`);
    return res.status(503).json({
      ok: false,
      error: 'The database is not reachable right now. Make sure MongoDB is running, then try again.',
    });
  }
  console.error(`[api] ${req.method} ${req.originalUrl}:`, err);
  return res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' });
}

function isDatabaseDown(err) {
  const name = String(err?.name || '');
  const message = String(err?.message || '');
  return (
    name === 'MongooseServerSelectionError' ||
    name === 'MongoServerSelectionError' ||
    name === 'MongoNetworkError' ||
    /server selection|buffering timed out|topology was destroyed|ECONNREFUSED/i.test(message)
  );
}
