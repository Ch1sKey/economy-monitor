import { Link } from "react-router-dom";
import type { PlayerRow } from "@/api/types";
import { formatMoney } from "@/utils/formatMoney";

const cols = [
  { key: "balance", label: "Balance", sort: "balance" as const },
  { key: "balance_change", label: "Δ window", sort: "net_change" as const },
  { key: "faucet_received", label: "Faucets", sort: "faucet_received" as const },
  { key: "sink_spent", label: "Sinks", sort: "sink_spent" as const },
  { key: "transfer_volume", label: "Transfers", sort: "transfer_volume" as const },
  { key: "unknown_delta", label: "Unknown", sort: "unknown_delta" as const },
];

export function PlayerTable({
  rows,
  sort,
  onSort,
}: {
  rows: PlayerRow[];
  sort: string;
  onSort: (s: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>UUID</th>
            {cols.map((c) => (
              <th key={c.key} onClick={() => onSort(c.sort)}>
                {c.label}
                {sort === c.sort ? " *" : ""}
              </th>
            ))}
            <th>Last seen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.player_uuid}>
              <td>{p.balance_rank}</td>
              <td>
                <Link to={`/players/${p.player_uuid}`}>{p.player_name ?? "—"}</Link>
              </td>
              <td className="muted" style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.player_uuid}
              </td>
              <td>{formatMoney(p.latest_balance)}</td>
              <td>{formatMoney(p.balance_change)}</td>
              <td>{formatMoney(p.faucet_received)}</td>
              <td>{formatMoney(p.sink_spent)}</td>
              <td>{formatMoney(p.transfer_volume)}</td>
              <td>{formatMoney(p.unknown_delta)}</td>
              <td>{p.last_seen ? new Date(p.last_seen).toLocaleString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
