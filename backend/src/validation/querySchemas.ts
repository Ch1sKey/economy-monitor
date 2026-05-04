import { z } from "zod";

export const timeframePresetSchema = z.enum([
  "today",
  "yesterday",
  "last_24h",
  "last_7d",
  "last_30d",
  "this_week",
  "this_month",
  "all_time",
]);

export const timeframeQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  preset: timeframePresetSchema.optional(),
  timezone: z.string().optional(),
  includeInferred: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => {
      if (v === undefined) return true;
      return v === true || v === "true";
    }),
});

export const overviewQuerySchema = timeframeQuerySchema;

export const playersQuerySchema = timeframeQuerySchema.extend({
  search: z.string().optional(),
  sort: z
    .enum([
      "balance",
      "net_change",
      "faucet_received",
      "sink_spent",
      "transfer_volume",
      "unknown_delta",
    ])
    .optional(),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(500).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export const eventsQuerySchema = timeframeQuerySchema.merge(paginationSchema).extend({
  source: z.string().optional(),
  action: z.string().optional(),
  player: z.string().optional(),
  confidence: z.string().optional(),
  item: z.string().optional(),
  transaction_id: z.string().optional(),
  min_delta: z.string().optional(),
  max_delta: z.string().optional(),
});

export const sankeyOverallQuerySchema = timeframeQuerySchema.extend({
  mode: z.enum(["collapsed", "top_n", "expanded"]).optional().default("collapsed"),
  topPlayers: z.coerce.number().min(1).max(100).optional().default(8),
  includeAuctionPending: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => {
      if (v === undefined) return false;
      return v === true || v === "true";
    }),
  minFlow: z.string().optional().default("0"),
  groupBy: z.enum(["default", "source", "action", "player", "item"]).optional().default("default"),
});

export const sankeyPlayerQuerySchema = timeframeQuerySchema.extend({
  minFlow: z.string().optional().default("0"),
  groupBy: z.enum(["default", "source", "action", "player", "item"]).optional().default("default"),
});

export const timeseriesQuerySchema = timeframeQuerySchema.extend({
  bucket: z.enum(["hour", "day"]).optional().default("day"),
});

export const playerUuidParamSchema = z.object({
  uuid: z.string().uuid(),
});
