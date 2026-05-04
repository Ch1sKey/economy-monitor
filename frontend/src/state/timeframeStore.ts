import { create } from "zustand";
import type { TimeframePreset } from "@/api/types";

const defaultTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

interface TimeframeState {
  preset: TimeframePreset;
  from: string | null;
  to: string | null;
  timezone: string;
  includeInferred: boolean;
  autoRefresh: boolean;
  setPreset: (p: TimeframePreset) => void;
  setCustom: (from: string | null, to: string | null) => void;
  setTimezone: (tz: string) => void;
  setIncludeInferred: (v: boolean) => void;
  setAutoRefresh: (v: boolean) => void;
}

export const useTimeframeStore = create<TimeframeState>((set) => ({
  preset: "last_7d",
  from: null,
  to: null,
  timezone: defaultTz,
  includeInferred: true,
  autoRefresh: false,
  setPreset: (preset) => set({ preset, from: null, to: null }),
  setCustom: (from, to) => set({ from, to }),
  setTimezone: (timezone) => set({ timezone }),
  setIncludeInferred: (includeInferred) => set({ includeInferred }),
  setAutoRefresh: (autoRefresh) => set({ autoRefresh }),
}));

export function timeframeQueryFromStore(s: TimeframeState) {
  const hasCustom = Boolean(s.from || s.to);
  return {
    preset: hasCustom ? undefined : s.preset,
    from: s.from ?? undefined,
    to: s.to ?? undefined,
    timezone: s.timezone,
    includeInferred: s.includeInferred,
  };
}

