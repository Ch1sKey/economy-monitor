import { useState } from "react";
import type { EventDTO } from "@/api/types";
import { formatMoney } from "@/utils/formatMoney";

export function EventsTable({ rows }: { rows: EventDTO[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>When</th>
            <th>Source</th>
            <th>Action</th>
            <th>Player</th>
            <th>Target</th>
            <th>Δ</th>
            <th>Item</th>
            <th>Conf.</th>
            <th>Tx</th>
            <th>Context</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td>{new Date(e.created_at).toLocaleString()}</td>
              <td>{e.source}</td>
              <td>{e.action}</td>
              <td>{e.player_name ?? e.player_uuid}</td>
              <td>{e.target_name ?? e.target_uuid}</td>
              <td>{formatMoney(e.money_delta)}</td>
              <td>{e.item_material}</td>
              <td>{e.confidence}</td>
              <td style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>{e.transaction_id}</td>
              <td>
                {e.context_json ? (
                  <button type="button" className="primary" onClick={() => setOpen((s) => ({ ...s, [e.id]: !s[e.id] }))}>
                    {open[e.id] ? "Hide" : "Show"}
                  </button>
                ) : (
                  "—"
                )}
                {open[e.id] && e.context_json ? (
                  <pre
                    style={{
                      marginTop: 8,
                      maxWidth: 520,
                      whiteSpace: "pre-wrap",
                      fontSize: 11,
                      background: "#0a0f18",
                      padding: 8,
                      borderRadius: 8,
                    }}
                  >
                    {e.context_json}
                  </pre>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
