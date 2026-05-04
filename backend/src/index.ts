import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { ZodError } from "zod";
import type { ApiEnv } from "./appEnv.js";
import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerMetaRoutes } from "./routes/meta.js";
import { registerOverviewRoutes } from "./routes/overview.js";
import { registerPlayerRoutes } from "./routes/players.js";
import { registerEventRoutes } from "./routes/events.js";
import { registerSankeyRoutes } from "./routes/sankey.js";
import { registerTimeseriesRoutes } from "./routes/timeseries.js";
import { registerDiagnosticsRoutes } from "./routes/diagnostics.js";

function main() {
  const config = loadConfig();
  const pool = createPool(config);

  const app = new Hono<ApiEnv>();

  app.onError((err, c) => {
    if (err instanceof ZodError) {
      return c.json({ error: "Validation failed", details: err.flatten() }, 400);
    }
    console.error(err);
    const e = err as Error & { statusCode?: number };
    const status = typeof e.statusCode === "number" ? e.statusCode : 500;
    const body: Record<string, unknown> = { error: e.message ?? "Internal Server Error" };
    if (status === 500) body.code = "INTERNAL_ERROR";
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  });

  const origins = config.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);
  app.use("*", cors({ origin: origins.length ? origins : "*" }));
  app.use("*", logger());

  app.use("*", async (c, next) => {
    c.set("pool", pool);
    await next();
  });

  registerHealthRoutes(app);
  registerMetaRoutes(app);
  registerOverviewRoutes(app);
  registerPlayerRoutes(app);
  registerEventRoutes(app);
  registerSankeyRoutes(app);
  registerTimeseriesRoutes(app);
  registerDiagnosticsRoutes(app);

  serve(
    {
      fetch: app.fetch,
      port: config.APP_PORT,
      hostname: "0.0.0.0",
    },
    (info) => {
      console.log(`EconomyManager API listening on http://0.0.0.0:${info.port}`);
    },
  );
}

main();
