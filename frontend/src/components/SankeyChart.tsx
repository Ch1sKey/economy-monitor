import { useMemo } from "react";
import ReactEcharts from "echarts-for-react";
import type { SankeyResponse } from "@/api/types";
import { num, formatMoney } from "@/utils/formatMoney";

/** Pixel height so ECharts has enough canvas; grows with graph size (page scrolls). */
function sankeyHeightPx(nodes: number, links: number): number {
  const n = Math.max(nodes, 1);
  const l = Math.max(links, 0);
  const verticalBudget = 160 + n * 40 + Math.min(l, 200) * 2;
  return Math.min(5200, Math.max(560, verticalBudget));
}

export function SankeyChart({ data, className }: { data: SankeyResponse; className?: string }) {
  const chartHeight = useMemo(() => sankeyHeightPx(data.nodes.length, data.links.length), [data.nodes.length, data.links.length]);

  const linkMeta = useMemo(() => {
    const m = new Map<string, (typeof data.links)[number]>();
    for (const l of data.links) {
      m.set(`${l.source}>>>${l.target}`, l);
    }
    return m;
  }, [data.links]);

  const idToLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of data.nodes) m.set(n.id, n.label);
    return m;
  }, [data.nodes]);

  const option = useMemo(
    () => ({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        formatter: (params: { dataType?: string; name?: string; data?: { source?: string; target?: string; value?: number } }) => {
          if (params.dataType === "edge" && params.data?.source && params.data?.target) {
            const meta = linkMeta.get(`${params.data.source}>>>${params.data.target}`);
            const amt = formatMoney(String(meta?.value ?? params.data.value ?? 0));
            return [
              `<div><b>${idToLabel.get(params.data.source) ?? params.data.source}</b> → <b>${idToLabel.get(params.data.target) ?? params.data.target}</b></div>`,
              `<div>Amount: <b>${amt}</b></div>`,
              meta?.action ? `<div>Action: ${meta.action}</div>` : "",
              meta?.sourceType ? `<div>Source: ${meta.sourceType}</div>` : "",
              meta?.confidence ? `<div>Confidence: ${meta.confidence}</div>` : "",
              meta?.eventCount != null ? `<div>Events: ${meta.eventCount}</div>` : "",
            ]
              .filter(Boolean)
              .join("");
          }
          const id = params.name ?? "";
          return `<div><b>${idToLabel.get(id) ?? id}</b></div><div class="muted">${id}</div>`;
        },
      },
      series: [
        {
          type: "sankey",
          left: "2%",
          right: "14%",
          top: "5%",
          bottom: "5%",
          emphasis: { focus: "adjacency" },
          nodeAlign: "justify",
          draggable: true,
          nodeWidth: 26,
          nodeGap: 24,
          layoutIterations: 96,
          data: data.nodes.map((n) => ({
            name: n.id,
            label: { formatter: () => n.label },
          })),
          links: data.links.map((l) => ({
            source: l.source,
            target: l.target,
            value: Math.max(num(l.value), 0.0001),
          })),
          lineStyle: { color: "gradient", curveness: 0.45 },
          itemStyle: { borderWidth: 0 },
          label: { color: "#e8eefc", fontSize: 11, distance: 6 },
        },
      ],
    }),
    [data.links, data.nodes, idToLabel, linkMeta],
  );

  return (
    <div className="sankey-chart-host" style={{ height: chartHeight }}>
      <ReactEcharts
        key={`${chartHeight}-${data.nodes.length}-${data.links.length}`}
        option={option}
        className={className}
        style={{ width: "100%", height: chartHeight }}
        opts={{ renderer: "canvas" }}
      />
    </div>
  );
}
