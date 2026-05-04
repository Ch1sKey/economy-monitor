/**
 * PM2 process file for the EconomyManager API (Hono + Node).
 *
 * Usage (from repo root):
 *   npm run build -w backend
 *   pm2 start ecosystem.config.cjs
 *   pm2 logs economymanager-api
 *   pm2 save && pm2 startup
 *
 * Env: `backend/src/config.ts` loads `.env` from repo root and `backend/` automatically.
 */
const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "economymanager-api",
      cwd: path.join(__dirname, "backend"),
      script: "dist/index.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "5s",
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
