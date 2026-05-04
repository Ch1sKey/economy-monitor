export function MetricCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <div className="metric-value">{value}</div>
      {hint ? <div className="muted" style={{ marginTop: 6, fontSize: "0.85rem" }}>{hint}</div> : null}
    </div>
  );
}
