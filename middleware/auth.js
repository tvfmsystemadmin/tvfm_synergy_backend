import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from './asyncHandler.js';
import { accessFor } from '../services/access.js';
import { hasAnyPage } from '../config/adminPages.js';

export const COOKIE_NAME = 'tvfm_admin';
export const SESSION_MS = 8 * 60 * 60 * 1000;

// httpOnly keeps the token away from page scripts. SameSite=Strict stops other sites from sending it.
// When the website and the API are on different sites (set CROSS_SITE_COOKIES=1 in backend/.env, served over https),
// the browser only sends the cookie with SameSite=None; Secure, so the admin login keeps working.
export function cookieBase() {
  if (env.crossSiteCookies) {
    return { httpOnly: true, sameSite: 'none', secure: true, path: '/' };
  }
  return { httpOnly: true, sameSite: 'strict', secure: env.isProd, path: '/' };
}

// Checks the login cookie, then loads the account's role and pages from the database. Every request uses the
// current rules, so a role change or a turned-off account takes effect on the next request.
// req.admin = { id, email, name, isOwner, pages, role }
export const requireAdmin = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) throw new HttpError(401, 'Please log in to continue.');

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw new HttpError(401, 'Your session has ended. Please log in again.');
  }

  const access = await accessFor(payload.sub);
  if (!access) throw new HttpError(401, 'Your session has ended. Please log in again.');
  req.admin = access;
  next();
});

// Lets the request through when the signed-in admin has at least one of the listed pages.
export function requirePage(...pages) {
  return (req, res, next) => {
    if (hasAnyPage(req.admin, pages)) return next();
    return next(new HttpError(403, 'You do not have access to this page. Ask an administrator to give you access.'));
  };
}
