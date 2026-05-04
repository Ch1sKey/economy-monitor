import { DateTime } from "luxon";

export type TimeframePreset =
  | "today"
  | "yesterday"
  | "last_24h"
  | "last_7d"
  | "last_30d"
  | "this_week"
  | "this_month"
  | "all_time";

export interface ResolvedTimeframe {
  from: Date | null;
  to: Date | null;
  preset: TimeframePreset | null;
  timezone: string;
}

function startOfWeek(dt: DateTime): DateTime {
  return dt.startOf("week");
}

function startOfMonth(dt: DateTime): DateTime {
  return dt.startOf("month");
}

export function resolveTimeframe(params: {
  from?: string | null;
  to?: string | null;
  preset?: TimeframePreset | null;
  timezone: string;
}): ResolvedTimeframe {
  const tz = params.timezone || "UTC";
  const now = DateTime.now().setZone(tz);

  if (params.preset === "all_time") {
    return { from: null, to: null, preset: "all_time", timezone: tz };
  }

  if (params.from || params.to) {
    let fromDt: DateTime | null = null;
    let toDt: DateTime | null = null;
    if (params.from) {
      fromDt = DateTime.fromISO(params.from, { zone: tz });
      if (!fromDt.isValid) {
        const d = DateTime.fromISO(`${params.from}T00:00:00`, { zone: tz });
        fromDt = d.isValid ? d : null;
      }
    }
    if (params.to) {
      toDt = DateTime.fromISO(params.to, { zone: tz });
      if (!toDt.isValid) {
        const d = DateTime.fromISO(`${params.to}T23:59:59.999`, { zone: tz });
        toDt = d.isValid ? d : null;
      }
    }
    if (fromDt && toDt && fromDt > toDt) {
      const tmp = fromDt;
      fromDt = toDt;
      toDt = tmp;
    }
    return {
      from: fromDt?.toJSDate() ?? null,
      to: toDt?.toJSDate() ?? null,
      preset: null,
      timezone: tz,
    };
  }

  const preset = params.preset ?? "last_7d";

  switch (preset) {
    case "today": {
      const start = now.startOf("day");
      return { from: start.toJSDate(), to: now.toJSDate(), preset, timezone: tz };
    }
    case "yesterday": {
      const y = now.minus({ days: 1 });
      return {
        from: y.startOf("day").toJSDate(),
        to: y.endOf("day").toJSDate(),
        preset,
        timezone: tz,
      };
    }
    case "last_24h":
      return {
        from: now.minus({ hours: 24 }).toJSDate(),
        to: now.toJSDate(),
        preset,
        timezone: tz,
      };
    case "last_7d":
      return {
        from: now.minus({ days: 7 }).toJSDate(),
        to: now.toJSDate(),
        preset,
        timezone: tz,
      };
    case "last_30d":
      return {
        from: now.minus({ days: 30 }).toJSDate(),
        to: now.toJSDate(),
        preset,
        timezone: tz,
      };
    case "this_week": {
      const start = startOfWeek(now);
      return { from: start.toJSDate(), to: now.toJSDate(), preset, timezone: tz };
    }
    case "this_month": {
      const start = startOfMonth(now);
      return { from: start.toJSDate(), to: now.toJSDate(), preset, timezone: tz };
    }
    default:
      return {
        from: now.minus({ days: 7 }).toJSDate(),
        to: now.toJSDate(),
        preset: "last_7d",
        timezone: tz,
      };
  }
}

/** When timeframe is open-ended, anchor balance deltas to known DB bounds. */
export function effectiveRangeForSnapshots(
  tf: ResolvedTimeframe,
  bounds: { min: Date | null; max: Date | null },
): { from: Date; to: Date } {
  const to = tf.to ?? bounds.max ?? new Date();
  const from = tf.from ?? bounds.min ?? new Date(0);
  if (from > to) return { from: to, to: from };
  return { from, to };
}

export function timeframeWhereClause(
  column: string,
  tf: ResolvedTimeframe,
): { sql: string; params: (string | Date)[] } {
  if (!tf.from && !tf.to) {
    return { sql: "1=1", params: [] };
  }
  const parts: string[] = [];
  const params: (string | Date)[] = [];
  if (tf.from) {
    parts.push(`${column} >= ?`);
    params.push(tf.from);
  }
  if (tf.to) {
    parts.push(`${column} <= ?`);
    params.push(tf.to);
  }
  return { sql: parts.join(" AND "), params };
}
