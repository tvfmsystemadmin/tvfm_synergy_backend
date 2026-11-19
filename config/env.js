import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '..', '.env') });

const toPositive = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const isProd = process.env.NODE_ENV === 'production';

// Always allowed, on top of FRONTEND_URL: the production sites. The local Vite dev server (port 5173)
// is added only outside production (NODE_ENV !== 'production').
const DEFAULT_ORIGINS = [
  'https://tvfmsynergy.com',
  'https://www.tvfmsynergy.com',
  ...(isProd ? [] : ['http://localhost:5173']),
];

export const env = {
  port: toPositive(process.env.PORT, 5000),
  isProd,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tvfm_synergy',
  jwtSecret: process.env.JWT_SECRET || '',
  // Sites allowed to call the API: the comma-separated FRONTEND_URL list, e.g.
  // FRONTEND_URL=https://tvfmsynergy.com,https://admin.tvfmsynergy.com
  // plus DEFAULT_ORIGINS above.
  frontendUrls: [
    ...new Set([
      ...(process.env.FRONTEND_URL || '').split(','),
      ...DEFAULT_ORIGINS,
    ].map((url) => url.trim().replace(/\/+$/, '')).filter(Boolean)),
  ],
  // Set to 1 when the API runs behind one proxy (Nginx, a hosting platform). Without it every visitor
  // appears to come from the proxy's IP, so the enquiry and login rate limits would be shared by everyone.
  trustProxy: toPositive(process.env.TRUST_PROXY, 0),
  // 1 when the website runs on a different address from the API (see middleware/auth.js). Needs https.
  crossSiteCookies: process.env.CROSS_SITE_COOKIES === '1',
  mailDryRun: process.env.MAIL_DRY_RUN === '1',
  defaultEnquiryEmail: process.env.MAIL_TO || 'tvfmsynergyllp@tvfmsynergy.com',
  posEnquiryEmail: process.env.MAIL_TO_POS || 'pos@tvfmsynergy.com',
  productEnquiryEmail: process.env.MAIL_TO_PRODUCT || 'glamcare@glamcompany.in',
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: toPositive(process.env.SMTP_PORT, 465),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    fromName: (process.env.MAIL_FROM_NAME || 'TVFM Website').replace(/["<>\r\n]/g, ''),
  },
  admin: {
    email: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
    password: process.env.ADMIN_PASSWORD || '',
    name: process.env.ADMIN_NAME || 'Admin',
  },
};

export function assertServerConfig() {
  if (env.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET is missing or shorter than 32 characters. Set it in backend/.env.');
  }
}
