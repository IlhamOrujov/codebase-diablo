"use client";

import { ScrollRegion } from "@/components/ui/primitives";
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { Copy, Download } from "lucide-react";
import { Segmented } from "@/components/ui/Segmented";
import { toast } from "@/lib/ui";
import { cn } from "@/lib/cn";

export interface ChartTable {
  columns: string[];
  rows: (string | number)[][];
}

/** Width of an element, tracked with ResizeObserver. */
export function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function toCSV(t: ChartTable) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [t.columns, ...t.rows].map((r) => r.map(esc).join(",")).join("\n");
}

const VARS = ["--chart-1", "--chart-2", "--ink", "--ink-2", "--ink-3", "--line", "--line-strong", "--surface", "--surface-sunken", "--accent", "--accent-ink", "--bg"];

/** Serialize an on-screen SVG into a standalone file with the theme's colours inlined. */
function svgFile(svg: SVGSVGElement): string {
  const css = getComputedStyle(document.documentElement);
  let s = new XMLSerializer().serializeToString(svg);
  for (const v of VARS) s = s.split(`var(${v})`).join(css.getPropertyValue(v).trim());
  if (!s.includes("xmlns=")) s = s.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  return `<?xml version="1.0" encoding="UTF-8"?>\n${s}`;
}

export function downloadText(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Shared frame for every chart: title, a one-sentence takeaway, units, an
 * "n = … · source" line, a Table view with the raw numbers, Copy CSV and
 * Download SVG. No entrance animation.
 */
export function ChartFrame({
  title,
  takeaway,
  units,
  source,
  table,
  fileName,
  children,
  className,
}: {
  title: string;
  takeaway: string;
  units: string;
  source: string;
  table: ChartTable;
  fileName: string;
  children: (ids: { titleId: string; descId: string }) => ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const titleId = useId();
  const descId = useId();
  const chartRef = useRef<HTMLDivElement>(null);
  return (
    <figure className={cn("print-break-avoid rounded-[10px] border border-line bg-surface p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <figcaption className="min-w-0 flex-1 basis-[260px]">
          <div id={titleId} className="text-[14px] font-medium text-ink">
            {title}
          </div>
          <p id={descId} className="mt-0.5 text-[13px] text-ink-2">
            {takeaway}
          </p>
        </figcaption>
        <div className="no-print flex items-center gap-1">
          <Segmented
            label={`${title}: view`}
            value={view}
            onChange={setView}
            items={[
              { value: "chart", label: "Chart" },
              { value: "table", label: "Table" },
            ]}
          />
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(toCSV(table));
                toast({ title: "CSV copied", body: `${table.rows.length} rows` });
              } catch {
                downloadText(`${fileName}.csv`, toCSV(table), "text/csv");
              }
            }}
            className="grid size-8 place-items-center rounded-[6px] text-ink-3 hover:bg-sunken hover:text-ink"
            aria-label={`Copy ${title} as CSV`}
            title="Copy CSV"
          >
            <Copy className="size-4" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => {
              const svg = chartRef.current?.querySelector("svg");
              if (svg) downloadText(`${fileName}.svg`, svgFile(svg), "image/svg+xml");
            }}
            disabled={view !== "chart"}
            className="grid size-8 place-items-center rounded-[6px] text-ink-3 hover:bg-sunken hover:text-ink disabled:opacity-40"
            aria-label={`Download ${title} as SVG`}
            title={view === "chart" ? "Download SVG" : "Switch to the chart to download it"}
          >
            <Download className="size-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
      <div className="mt-3" ref={chartRef}>
        {view === "chart" ? (
          children({ titleId, descId })
        ) : (
          <ScrollRegion label={`${title} as a table`}>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-ink-3">
                  {table.columns.map((c) => (
                    <th key={c} scope="col" className="py-1.5 pr-4 font-normal">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    {r.map((v, j) => (
                      <td key={j} className={cn("py-1.5 pr-4", j > 0 && "font-mono tabular text-ink-2")}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 text-[12px] text-ink-3">
        <span>{units}</span>
        <span>{source}</span>
      </div>
    </figure>
  );
}

/** Linear scale. */
export function scale(d0: number, d1: number, r0: number, r1: number) {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (v: number) => r0 + (v - d0) * k;
}

export function ticks(lo: number, hi: number, step: number) {
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

/** Truncate a label to fit roughly `px` at 13px Geist. */
export function fit(label: string, px: number, charPx = 7) {
  const max = Math.max(4, Math.floor(px / charPx));
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}
