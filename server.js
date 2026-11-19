import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { env, assertServerConfig } from './config/env.js';
import { connectDb } from './config/db.js';
import { ensureDefaultRoute } from './services/startingRoutes.js';
import { ensureAccessSetup } from './services/access.js';
import apiRoutes from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { UPLOAD_ROOT, TMP_DIR } from './middleware/upload.js';

// Builds the Express app. The Vite dev server can mount this same app later, so there is one API for all environments.
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.trustProxy) app.set('trust proxy', env.trustProxy);
  app.use('/api', helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  if (env.frontendUrl) app.use('/api', cors({ origin: env.frontendUrl, credentials: true }));
  app.use(express.json({ limit: '4mb' }));
  app.use(cookieParser());
  app.use(
    '/uploads',
    express.static(UPLOAD_ROOT, {
      dotfiles: 'deny',
      index: false,
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );
  app.use('/api', apiRoutes);
  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}

async function start() {
  assertServerConfig();
  fs.mkdirSync(TMP_DIR, { recursive: true });
  await connectDb();
  await ensureDefaultRoute();
  // Creates the Owner role and gives accounts from before roles the Owner role.
  await ensureAccessSetup();
  const server = createApp().listen(env.port, () => {
    console.log(`TVFM Synergy API running on http://localhost:${env.port}`);
  });
  const shutdown = async () => {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  start().catch((err) => {
    console.error(`Startup failed: ${err.message}`);
    process.exit(1);
  });
}
