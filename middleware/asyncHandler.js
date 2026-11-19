// Express 4 does not catch errors from async functions, so this passes them to the error handler.
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
