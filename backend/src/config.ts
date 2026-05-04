import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/** Directory containing this file: `backend/src`. */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");
/** Monorepo root (parent of `backend/`). */
const repoRoot = path.resolve(backendRoot, "..");

/**
 * `import "dotenv/config"` only loads `<cwd>/.env`. With `npm run dev -w backend`,
 * cwd is usually `backend/`, so a repo-root `.env` is never read. Load both.
 */
function loadEnvFromKnownLocations() {
  const paths = [
    path.join(repoRoot, ".env"),
    path.join(repoRoot, ".env.local"),
    path.join(backendRoot, ".env"),
    path.join(backendRoot, ".env.local"),
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), ".env.local"),
  ];
  for (const p of paths) {
    dotenv.config({ path: p });
  }
}

loadEnvFromKnownLocations();

const envSchema = z.object({
  DB_HOST: z.string().default("127.0.0.1"),
  DB_PORT: z.coerce.number().default(3306),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(""),
  APP_PORT: z.coerce.number().default(3001),
  DEFAULT_TIMEZONE: z.string().default("UTC"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment: ${JSON.stringify(msg)}`);
  }
  return parsed.data;
}
