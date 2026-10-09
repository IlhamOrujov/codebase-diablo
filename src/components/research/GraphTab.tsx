"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Maximize, Minus, Plus } from "lucide-react";
import { motion } from "motion/react";
import { IconButton } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { StatusDot } from "@/components/ui/Status";
import { cn } from "@/lib/cn";
import { VERDICT_LABEL } from "@/lib/data/interpret";
import { useWS } from "./context";
import { useMediaQuery, VerdictTag } from "./common";
import { buildGraph, LABEL_W, LAYERS, layout, lineage, type GNode, type Placed } from "./graph-model";

type View = { x: number; y: number; k: number };
/** Pan and zoom per investigation survive tab switches and resizes (refit only on first view or Fit). */
const views = new Map<string, View>();
const MIN_K = 0.3;
const MAX_K = 2.5;

export function GraphTab() {
  const narrow = useMediaQuery("(max-width: 767px)");
  const [mode, setMode] = useState<"graph" | "list" | null>(null);
  const view = mode ?? (narrow ? "list" : "graph");
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[13px] text-ink-2">
          {view === "graph" ? "Drag or scroll to move, Ctrl or ⌘ + scroll to zoom, double-click to fit. Tab to a node; arrows move between nodes; Enter opens it." : "The same graph as a nested list."}
        </p>
        <Segmented
          label="Graph view"
          value={view}
          onChange={setMode}
          items={[
            { value: "graph", label: "Graph" },
            { value: "list", label: "List" },
          ]}
        />
      </div>
      {view === "graph" ? <GraphCanvas /> : <GraphList />}
    </div>
  );
}

function useGraph() {
  const { inv, assessment } = useWS();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const nodes = buildGraph(inv, assessment, expanded);
  return { nodes, expand: (layer: number) => setExpanded((s) => new Set(s).add(layer)) };
}

function GraphCanvas() {
  const { inv, openRef, selectedExp } = useWS();
  const { nodes, expand } = useGraph();
  const [heights, setHeights] = useState<Record<string, number>>({});
  const { placed, width, height, layerY } = layout(nodes, heights);
  const box = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const [v, setV] = useState<View | null>(() => views.get(inv.id) ?? null);
  const [hover, setHover] = useState<string | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; vx: number; vy: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const commit = (next: View) => {
    views.set(inv.id, next);
    setV(next);
  };

  // First view: 100% (node text at its full 13px) unless the graph is too wide, top-aligned; scroll to see more.
  const initial = () => {
    const el = box.current;
    if (!el) return;
    const cw = el.clientWidth;
    const k = Math.max(0.6, Math.min(1, (cw - 32) / width));
    commit({ k, x: (cw - width * k) / 2, y: 8 });
  };

  const fit = () => {
    const el = box.current;
    if (!el) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const k = Math.max(0.5, Math.min(1, (cw - 32) / width, (ch - 32) / height));
    commit({ k, x: (cw - width * k) / 2, y: Math.max(16, (ch - height * k) / 2) });
  };

  // Measure real node heights (nodes size to their content and never clip); edges follow.
  const observer = useRef<ResizeObserver | null>(null);
  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      setHeights((prev) => {
        let next = prev;
        for (const e of entries) {
          const nid = (e.target as HTMLElement).dataset.node ?? "";
          const h = Math.ceil((e.target as HTMLElement).offsetHeight);
          if (nid && prev[nid] !== h) next = { ...next, [nid]: h };
        }
        return next;
      });
    });
    observer.current = ro;
    nodeRefs.current.forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, []);

  // First view of this investigation: fit once. Afterwards keep the user's pan and zoom,
  // through resizes and tab switches (the view lives outside the component).
  useLayoutEffect(() => {
    if (!views.has(inv.id)) initial();
  });

  // Wheel: scroll pans; Ctrl/⌘ + wheel (and trackpad pinch, which sends ctrlKey) zooms at the pointer.
  const id = inv.id;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cur = views.get(id) ?? { x: 0, y: 0, k: 1 };
      let next: View;
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        const px = e.clientX - r.left;
        const py = e.clientY - r.top;
        const k = Math.min(MAX_K, Math.max(MIN_K, cur.k * Math.exp(-e.deltaY * 0.0025)));
        next = { k, x: px - ((px - cur.x) * k) / cur.k, y: py - ((py - cur.y) * k) / cur.k };
      } else {
        next = { ...cur, x: cur.x - e.deltaX, y: cur.y - e.deltaY };
      }
      views.set(id, next);
      setV(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [id]);

  const zoomBy = (f: number) => {
    const el = box.current;
    const cur = v ?? { x: 0, y: 0, k: 1 };
    if (!el) return;
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    const k = Math.min(MAX_K, Math.max(MIN_K, cur.k * f));
    commit({ k, x: cx - ((cx - cur.x) * k) / cur.k, y: cy - ((cy - cur.y) * k) / cur.k });
  };

  const end = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    if (box.current?.hasPointerCapture(e.pointerId)) box.current.releasePointerCapture(e.pointerId);
    drag.current = null;
    setDragging(false);
  };

  const byId = new Map(placed.map((p) => [p.id, p]));
  const lit = hover ? lineage(nodes, hover) : null;

  const focusNode = (id: string | undefined) => {
    if (!id) return;
    const el = nodeRefs.current.get(id);
    el?.focus();
    // Keep the focused node in view.
    const p = byId.get(id);
    const c = box.current;
    const cur = views.get(inv.id);
    if (!p || !c || !cur) return;
    const sx = cur.x + p.x * cur.k;
    const sy = cur.y + p.y * cur.k;
    let { x, y } = cur;
    if (sx < 16) x += 16 - sx;
    if (sx + p.w * cur.k > c.clientWidth - 16) x -= sx + p.w * cur.k - c.clientWidth + 16;
    if (sy < 16) y += 16 - sy;
    if (sy + p.h * cur.k > c.clientHeight - 16) y -= sy + p.h * cur.k - c.clientHeight + 16;
    if (x !== cur.x || y !== cur.y) commit({ ...cur, x, y });
  };

  const onNodeKey = (e: KeyboardEvent, n: Placed) => {
    const sameLayer = placed.filter((p) => p.layer === n.layer);
    const i = sameLayer.findIndex((p) => p.id === n.id);
    if (e.key === "ArrowUp") focusNode(n.parents[0] ?? placed.filter((p) => p.layer < n.layer).at(-1)?.id);
    else if (e.key === "ArrowDown") focusNode(placed.find((p) => p.parents.includes(n.id))?.id ?? placed.find((p) => p.layer > n.layer)?.id);
    else if (e.key === "ArrowLeft") focusNode(sameLayer[i - 1]?.id);
    else if (e.key === "ArrowRight") focusNode(sameLayer[i + 1]?.id);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  const activate = (n: GNode) => {
    if (n.kind === "more" && n.expands !== undefined) expand(n.expands);
    else if (n.ref) openRef(n.ref);
  };

  const t = v ?? { x: 0, y: 0, k: 1 };

  return (
    <div
      ref={box}
      tabIndex={0}
      role="application"
      aria-label={`Research graph for ${inv.title}. Use Tab to reach nodes; plus, minus and zero zoom and fit.`}
      onKeyDown={(e) => {
        if (e.key === "+" || e.key === "=") zoomBy(1.2);
        else if (e.key === "-" || e.key === "_") zoomBy(1 / 1.2);
        else if (e.key === "0") fit();
        else return;
        e.preventDefault();
      }}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-node]")) return;
        fit();
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("[data-node],[data-control]") || e.button !== 0) return;
        box.current?.setPointerCapture(e.pointerId);
        drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, vx: t.x, vy: t.y };
        setDragging(true);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        commit({ ...t, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y });
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      className={cn(
        "graph-canvas relative h-[calc(100dvh-250px)] min-h-[440px] touch-none select-none overflow-hidden rounded-[10px] border border-line bg-subtle",
        dragging ? "cursor-grabbing" : "cursor-grab",
      )}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width, height, transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})`, visibility: v ? "visible" : "hidden" }}
      >
        {/* Layer labels */}
        {LAYERS.map((label, i) =>
          placed.some((p) => p.layer === i) ? (
            <div key={label} className="absolute left-4 text-[12px] text-ink-3" style={{ top: layerY[i] + 4, width: LABEL_W - 8 }}>
              {label}
            </div>
          ) : null,
        )}
        <svg width={width} height={height} className="absolute inset-0 overflow-visible" aria-hidden>
          {placed.flatMap((n) =>
            n.parents.map((pid) => {
              const p = byId.get(pid)!;
              const x1 = p.x + p.w / 2;
              const y1 = p.y + p.h;
              const x2 = n.x + n.w / 2;
              const y2 = n.y;
              const my = (y1 + y2) / 2;
              const d = `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
              const on = !lit || (lit.has(n.id) && lit.has(pid));
              const strong = !!lit && on;
              // Data is flowing along edges into and out of a running experiment.
              const live = n.status === "running" || p.status === "running";
              return (
                <g key={`${pid}-${n.id}`}>
                  <motion.path
                    d={d}
                    fill="none"
                    stroke={strong ? "var(--accent-text)" : "var(--line-strong)"}
                    strokeWidth={strong ? 1.6 : 1}
                    strokeDasharray={n.dashed ? "3 5" : undefined}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: on ? 1 : 0.45 }}
                    transition={{ pathLength: { duration: 0.6, delay: 0.1 + n.layer * 0.09, ease: [0.16, 1, 0.3, 1] }, opacity: { duration: 0.18 } }}
                    style={{ transition: "stroke 180ms, stroke-width 180ms" }}
                  />
                  {live && <path d={d} fill="none" stroke="var(--accent-text)" strokeWidth={1.4} className="edge-flow" opacity={on ? 0.9 : 0.3} />}
                  <motion.circle
                    cx={x2}
                    cy={y2}
                    r={2}
                    fill={strong ? "var(--accent-text)" : "var(--line-strong)"}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1, opacity: on ? 1 : 0.45 }}
                    transition={{ delay: 0.45 + n.layer * 0.09, type: "spring", stiffness: 500, damping: 30 }}
                  />
                </g>
              );
            }),
          )}
        </svg>
        {placed.map((n, i) => {
          const dim = lit && !lit.has(n.id);
          const inLine = !!lit && !dim && !(n.kind === "experiment" && selectedExp === n.id);
          const selected = n.kind === "experiment" && selectedExp === n.id;
          return (
            <motion.button
              key={n.id}
              ref={(el) => {
                if (el) {
                  nodeRefs.current.set(n.id, el);
                  observer.current?.observe(el);
                } else nodeRefs.current.delete(n.id);
              }}
              type="button"
              data-node={n.id}
              onClick={() => activate(n)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  activate(n);
                  return;
                }
                onNodeKey(e, n);
              }}
              onPointerEnter={() => setHover(n.id)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(n.id)}
              onBlur={() => setHover(null)}
              aria-label={`${LAYERS[n.layer]}: ${n.head} ${n.text}${n.verdict ? `, ${VERDICT_LABEL[n.verdict]}` : ""}${n.status ? `, ${n.status}` : ""}${n.mono ? `, ${n.mono}` : ""}`}
              aria-pressed={n.kind === "experiment" ? selected : undefined}
              // Nodes arrive layer by layer, the way the research was built.
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: dim ? 0.55 : 1, y: 0, scale: 1 }}
              whileHover={{ y: -2, transition: { type: "spring", stiffness: 420, damping: 26 } }}
              transition={{
                default: { type: "spring", stiffness: 260, damping: 26, delay: n.layer * 0.09 + (i % 6) * 0.025 },
                opacity: { duration: 0.18 },
              }}
              className={cn(
                "absolute cursor-pointer rounded-[10px] border px-3 py-2 text-left transition-[background-color,border-color,box-shadow,color] duration-200",
                n.dashed ? "border-dashed" : "",
                selected
                  ? "border-accent bg-accent text-accent-ink shadow-[0_12px_30px_-12px_rgb(87_0_26/0.6)] [&_*]:!text-accent-ink"
                  : inLine
                    ? "border-highlight-line bg-highlight shadow-[var(--shadow-2)]"
                    : cn("bg-surface hover:shadow-[var(--shadow-2)]", dim ? "border-line" : "border-line-strong"),
                n.kind === "more" && "grid place-items-center text-ink-2",
              )}
              style={{ left: n.x, top: n.y, width: n.w }}
            >
              {n.kind === "more" ? (
                <span className="text-[13px]">{n.text}</span>
              ) : (
                <>
                  <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
                    {n.status && <StatusDot status={n.status} label={false} />}
                    <span className="truncate">{n.head}</span>
                    {n.verdict && <VerdictTag verdict={n.verdict} className="ml-auto text-[12px]" />}
                  </span>
                  <span className={cn("mt-0.5 block text-[13px] leading-[18px]", dim ? "text-ink-2" : "text-ink", n.kind === "question" && "font-serif text-[15px] leading-[22px]")}>
                    {n.text}
                  </span>
                  {n.mono && <span className="mt-0.5 block font-mono text-[12px] leading-[18px] text-ink-2">{n.mono}</span>}
                </>
              )}
            </motion.button>
          );
        })}
      </div>

      <div data-control className="absolute right-2 top-2 flex items-center gap-0.5 rounded-[10px] border border-line bg-surface p-0.5 shadow-[var(--shadow-2)]">
        <IconButton label="Zoom out" hint="−" icon={<Minus strokeWidth={1.5} />} onClick={() => zoomBy(1 / 1.2)} />
        <span className="w-12 text-center font-mono text-[12px] text-ink-2" aria-live="polite">
          {Math.round(t.k * 100)}%
        </span>
        <IconButton label="Zoom in" hint="+" icon={<Plus strokeWidth={1.5} />} onClick={() => zoomBy(1.2)} />
        <IconButton label="Fit to view" hint="0" icon={<Maximize strokeWidth={1.5} />} onClick={fit} />
      </div>
    </div>
  );
}

/** The same graph as nested lists (an accessible alternative, default under 768px). */
function GraphList() {
  const { openRef } = useWS();
  const { nodes } = useGraph();
  const children = (id: string, layer: number) => nodes.filter((n) => n.layer === layer && n.parents.includes(id));
  const item = (n: GNode) => (
    <button type="button" onClick={() => n.ref && openRef(n.ref)} className="text-left hover:underline" disabled={!n.ref}>
      <span className="text-[12px] text-ink-3">{n.head} </span>
      <span className="text-ink">{n.text}</span>
      {n.mono && <span className="block font-mono text-[12px] text-ink-2">{n.mono}</span>}
      {n.verdict && <span className="text-[13px] text-ink-2"> · {VERDICT_LABEL[n.verdict]}</span>}
      {n.status && <span className="text-[13px] text-ink-2"> · {n.status}</span>}
    </button>
  );
  const q = nodes.find((n) => n.kind === "question")!;
  const c = nodes.find((n) => n.kind === "conclusion");
  const next = nodes.filter((n) => n.kind === "next");
  return (
    <div className="space-y-4 rounded-[10px] border border-line bg-surface p-4 text-[14px]">
      <ul className="space-y-2">
        <li>
          {item(q)}
          <ul className="ml-4 mt-2 space-y-2 border-l border-line pl-4">
            {children("Q", 1).map((h) => (
              <li key={h.id}>
                {item(h)}
                <ul className="ml-4 mt-2 space-y-2 border-l border-line pl-4">
                  {children(h.id, 2).map((e) => (
                    <li key={e.id}>
                      {item(e)}
                      {children(e.id, 3).length > 0 && (
                        <ul className="ml-4 mt-2 space-y-2 border-l border-line pl-4">
                          {children(e.id, 3).map((ev) => (
                            <li key={ev.id}>{item(ev)}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </li>
      </ul>
      {c && (
        <div>
          <div className="text-[12px] text-ink-3">Conclusion</div>
          <p className="text-ink">{c.text}</p>
        </div>
      )}
      {next.length > 0 && (
        <div>
          <div className="text-[12px] text-ink-3">Next</div>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {next.map((n) => (
              <li key={n.id}>{item(n)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
