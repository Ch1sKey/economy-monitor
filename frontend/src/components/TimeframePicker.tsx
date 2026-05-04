import { useQueryClient } from "@tanstack/react-query";
import { useTimeframeStore } from "@/state/timeframeStore";
import type { TimeframePreset } from "@/api/types";

const presets: { id: TimeframePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last_24h", label: "Last 24h" },
  { id: "last_7d", label: "Last 7d" },
  { id: "last_30d", label: "Last 30d" },
  { id: "this_week", label: "This week" },
  { id: "this_month", label: "This month" },
  { id: "all_time", label: "All time" },
];

export function TimeframePicker() {
  const qc = useQueryClient();
  const {
    preset,
    from,
    to,
    timezone,
    includeInferred,
    autoRefresh,
    setPreset,
    setCustom,
    setTimezone,
    setIncludeInferred,
    setAutoRefresh,
  } = useTimeframeStore();

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <label className="muted">
          Preset
          <select
            style={{ marginLeft: 8 }}
            value={preset}
            onChange={(e) => setPreset(e.target.value as TimeframePreset)}
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="muted">
          From
          <input
            type="datetime-local"
            style={{ marginLeft: 8 }}
            value={from ?? ""}
            onChange={(e) => setCustom(e.target.value || null, to)}
          />
        </label>
        <label className="muted">
          To
          <input
            type="datetime-local"
            style={{ marginLeft: 8 }}
            value={to ?? ""}
            onChange={(e) => setCustom(from, e.target.value || null)}
          />
        </label>
        <label className="muted">
          TZ
          <input
            style={{ marginLeft: 8, minWidth: 180 }}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="e.g. UTC"
          />
        </label>
        <label className="muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={includeInferred}
            onChange={(e) => setIncludeInferred(e.target.checked)}
          />
          Include inferred
        </label>
        <label className="muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
          Auto refresh (60s)
        </label>
        <button type="button" className="primary" onClick={() => void qc.invalidateQueries()}>
          Refresh
        </button>
      </div>
    </div>
  );
}
