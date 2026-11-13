import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, forwardRef } from "react";
import type { Surface, Vec } from "@/types";
import type { LayoutResult } from "@/lib/layout";
import { Drawing } from "./Drawing";
import { fitView, toScreen, toWorld, type DrawingOptions, type Selection, type View } from "@/lib/view";
import { bboxOf, deg2rad, dist, pointInRings, rotate } from "@/lib/geometry";
import { cm } from "@/lib/format";

export type Tool = "select" | "paint" | "move" | "draw";

export interface ViewportHandle {
  fit: () => void;
  finishDraw: () => void;
  cancelDraw: () => void;
  undoDrawPoint: () => void;
}

interface Props extends DrawingOptions {
  surface: Surface;
  layout: LayoutResult;
  tool: Tool;
  paintColor: number;
  selection: Selection;
  onSelect: (sel: Selection) => void;
  /** modification de la surface ; `first` indique le début d'un geste (nouvelle étape d'historique) */
  onChange: (fn: (s: Surface) => Surface, first: boolean) => void;
  onDrawComplete: (pts: Vec[]) => void;
  onDrawPointsChange?: (n: number) => void;
}

type Gesture =
  | { kind: "pan"; start: Vec; view: View; moved: boolean }
  | { kind: "pinch"; d0: number; c0: Vec; view: View }
  | { kind: "vertex"; index: number; moved: boolean }
  | { kind: "opening"; id: string; grab: Vec; orig: Vec; moved: boolean }
  | { kind: "move"; start: Vec; orig: Vec; moved: boolean }
  | { kind: "paint"; last: string | null; lastPt: Vec | null; first: boolean }
  | { kind: "draw"; start: Vec; view: View; moved: boolean };

const HANDLE_R = 9;

export const Viewport = forwardRef<ViewportHandle, Props>(function Viewport(
  {
    surface,
    layout,
    tool,
    paintColor,
    selection,
    onSelect,
    onChange,
    onDrawComplete,
    onDrawPointsChange,
    showCuts,
    showCutLabels,
    showDims,
  },
  ref
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ s: 0.1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const pointers = useRef(new Map<number, Vec>());
  const gesture = useRef<Gesture | null>(null);
  const [drawPts, setDrawPts] = useState<Vec[]>([]);
  const [hover, setHover] = useState<Vec | null>(null);
  const drawRef = useRef<Vec[]>([]);
  drawRef.current = drawPts;

  const surfaceRef = useRef(surface);
  surfaceRef.current = surface;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setSize({ w: r.width, h: r.height });
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    if (size.w <= 0 || size.h <= 0) return;
    const mobile = size.w < 768;
    setView(
      fitView(
        surfaceRef.current,
        size.w,
        size.h,
        mobile ? { top: 100, right: 34, bottom: 70, left: 34 } : { top: 52, right: 52, bottom: 76, left: 92 }
      )
    );
  }, [size.w, size.h]);

  // recadrage automatique au changement de surface ou de taille
  useEffect(() => {
    fit();
  }, [surface.id, fit]);

  useEffect(() => {
    onDrawPointsChange?.(drawPts.length);
  }, [drawPts.length, onDrawPointsChange]);

  useEffect(() => {
    if (tool !== "draw") setDrawPts([]);
  }, [tool]);

  const finishDraw = useCallback(() => {
    const pts = drawRef.current;
    if (pts.length >= 3) onDrawComplete(pts);
    setDrawPts([]);
  }, [onDrawComplete]);

  useImperativeHandle(
    ref,
    () => ({
      fit,
      finishDraw,
      cancelDraw: () => setDrawPts([]),
      undoDrawPoint: () => setDrawPts((p) => p.slice(0, -1)),
    }),
    [fit, finishDraw]
  );

  // zoom molette
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const p = { x: e.clientX - r.left, y: e.clientY - r.top };
      const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      setView((v) => zoomAt(v, p, k));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const localPoint = (e: React.PointerEvent): Vec => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const snapStep = () => {
    const s = viewRef.current.s;
    return s > 0.6 ? 1 : s > 0.25 ? 5 : s > 0.08 ? 10 : 50;
  };
  const snap = (v: number, step = snapStep()) => Math.round(v / step) * step;

  /** Point de dessin aimanté : grille + angles multiples de 45° + alignement sur les points existants. */
  const snapDrawPoint = (wp: Vec, pts: Vec[]): Vec => {
    const step = snapStep() >= 10 ? snapStep() : 10;
    let p = { x: snap(wp.x, step), y: snap(wp.y, step) };
    const tol = 12 / viewRef.current.s;
    if (pts.length) {
      const prev = pts[pts.length - 1];
      const dx = wp.x - prev.x;
      const dy = wp.y - prev.y;
      const ang = Math.atan2(dy, dx);
      const q = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
      if (Math.abs(ang - q) < deg2rad(7)) {
        const l = snap(Math.hypot(dx, dy), step);
        p = { x: prev.x + Math.cos(q) * l, y: prev.y + Math.sin(q) * l };
        if (Math.abs(Math.cos(q)) < 1e-9) p.x = prev.x;
        if (Math.abs(Math.sin(q)) < 1e-9) p.y = prev.y;
      }
      // fermeture orthogonale sur le premier point
      const first = pts[0];
      if (Math.abs(p.x - first.x) < tol) p.x = first.x;
      if (Math.abs(p.y - first.y) < tol && Math.abs(Math.sin(q)) > 1e-9) p.y = first.y;
    }
    return { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 };
  };

  const hitVertex = (sp: Vec): number => {
    const pts = surfaceRef.current.outline;
    let best = -1;
    let bd = HANDLE_R + 10;
    pts.forEach((p, i) => {
      const d = dist(toScreen(viewRef.current, p), sp);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  };

  const hitEdge = (sp: Vec): number => {
    const pts = surfaceRef.current.outline;
    let best = -1;
    let bd = 14;
    for (let i = 0; i < pts.length; i++) {
      const a = toScreen(viewRef.current, pts[i]);
      const b = toScreen(viewRef.current, pts[(i + 1) % pts.length]);
      const d = distToSegment(sp, a, b);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  };

  const hitOpening = (wp: Vec): string | null => {
    const ops = surfaceRef.current.openings;
    for (let i = ops.length - 1; i >= 0; i--) {
      const o = ops[i];
      if (wp.x >= o.x && wp.x <= o.x + o.w && wp.y >= o.y && wp.y <= o.y + o.h) return o.id;
    }
    return null;
  };

  const hitTile = (wp: Vec): string | null => {
    for (const t of layoutRef.current.tiles) {
      const b = bboxOf(t.poly);
      if (wp.x < b.minX || wp.x > b.maxX || wp.y < b.minY || wp.y > b.maxY) continue;
      if (pointInRings(wp, [t.poly])) return t.key;
    }
    return null;
  };

  const paintAt = (wp: Vec, g: Extract<Gesture, { kind: "paint" }>) => {
    // interpolation entre deux événements pour ne sauter aucun carreau lors d'un geste rapide
    const from = g.lastPt ?? wp;
    const t = surfaceRef.current.tile;
    const step = Math.max(2, Math.min(t.w, t.h) / 3);
    const n = Math.min(300, Math.ceil(dist(from, wp) / step));
    const keys: string[] = [];
    for (let i = 0; i <= n; i++) {
      const p = n === 0 ? wp : { x: from.x + ((wp.x - from.x) * i) / n, y: from.y + ((wp.y - from.y) * i) / n };
      const key = hitTile(p);
      if (key && key !== g.last && !keys.includes(key)) keys.push(key);
      if (key) g.last = key;
    }
    g.lastPt = wp;
    if (!keys.length) return;
    const first = g.first;
    g.first = false;
    onChange((s) => {
      const paint = { ...s.colors.paint };
      for (const key of keys) {
        if (paintColor < 0) delete paint[key];
        else paint[key] = paintColor;
      }
      return { ...s, colors: { ...s.colors, paint } };
    }, first);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    try {
      svgRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const sp = localPoint(e);
    pointers.current.set(e.pointerId, sp);
    if (e.button === 1 || e.button === 2) {
      gesture.current = { kind: "pan", start: sp, view: viewRef.current, moved: true };
      return;
    }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: "pinch", d0: dist(a, b), c0: mid(a, b), view: viewRef.current };
      return;
    }
    if (pointers.current.size > 2) return;
    const wp = toWorld(viewRef.current, sp);
    const s = surfaceRef.current;

    if (tool === "draw") {
      gesture.current = { kind: "draw", start: sp, view: viewRef.current, moved: false };
      return;
    }
    if (tool === "paint") {
      const g: Gesture = { kind: "paint", last: null, lastPt: null, first: true };
      gesture.current = g;
      paintAt(wp, g);
      return;
    }
    if (tool === "move") {
      gesture.current = { kind: "move", start: sp, orig: { x: s.layout.offsetX, y: s.layout.offsetY }, moved: false };
      return;
    }
    // sélection
    const vi = hitVertex(sp);
    if (vi >= 0) {
      gesture.current = { kind: "vertex", index: vi, moved: false };
      onSelect({ edge: null, opening: null });
      return;
    }
    const oid = hitOpening(wp);
    if (oid) {
      const o = s.openings.find((o) => o.id === oid)!;
      gesture.current = { kind: "opening", id: oid, grab: wp, orig: { x: o.x, y: o.y }, moved: false };
      onSelect({ edge: null, opening: oid });
      return;
    }
    const ei = hitEdge(sp);
    if (ei >= 0) {
      onSelect({ edge: ei, opening: null });
      gesture.current = { kind: "pan", start: sp, view: viewRef.current, moved: false };
      return;
    }
    gesture.current = { kind: "pan", start: sp, view: viewRef.current, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const sp = localPoint(e);
    if (tool === "draw" && e.pointerType === "mouse") setHover(sp);
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, sp);
    const g = gesture.current;
    if (!g) return;

    if (g.kind === "pinch") {
      const pts = [...pointers.current.values()];
      if (pts.length < 2) return;
      const [a, b] = pts;
      const d = dist(a, b);
      const c = mid(a, b);
      const k = d / Math.max(1, g.d0);
      let v = zoomAt(g.view, g.c0, k);
      v = { ...v, tx: v.tx + (c.x - g.c0.x), ty: v.ty + (c.y - g.c0.y) };
      setView(v);
      return;
    }
    if (g.kind === "pan" || g.kind === "draw") {
      const dx = sp.x - g.start.x;
      const dy = sp.y - g.start.y;
      if (!g.moved && Math.hypot(dx, dy) < 6) return;
      g.moved = true;
      setView({ ...g.view, tx: g.view.tx + dx, ty: g.view.ty + dy });
      return;
    }
    const wp = toWorld(viewRef.current, sp);
    if (g.kind === "paint") {
      paintAt(wp, g);
      return;
    }
    if (g.kind === "move") {
      const dx = (sp.x - g.start.x) / viewRef.current.s;
      const dy = -(sp.y - g.start.y) / viewRef.current.s;
      if (!g.moved && Math.hypot(sp.x - g.start.x, sp.y - g.start.y) < 3) return;
      const first = !g.moved;
      g.moved = true;
      const local = rotate({ x: dx, y: dy }, -deg2rad(surfaceRef.current.layout.angle));
      const step = snapStep() >= 10 ? 5 : 1;
      onChange(
        (s) => ({
          ...s,
          layout: {
            ...s.layout,
            offsetX: Math.round((g.orig.x + local.x) / step) * step,
            offsetY: Math.round((g.orig.y + local.y) / step) * step,
          },
        }),
        first
      );
      return;
    }
    if (g.kind === "vertex") {
      const s = surfaceRef.current;
      const n = s.outline.length;
      let p = { x: snap(wp.x), y: snap(wp.y) };
      const tol = 10 / viewRef.current.s;
      const prev = s.outline[(g.index - 1 + n) % n];
      const next = s.outline[(g.index + 1) % n];
      for (const q of [prev, next]) {
        if (Math.abs(wp.x - q.x) < tol) p.x = q.x;
        if (Math.abs(wp.y - q.y) < tol) p.y = q.y;
      }
      p = { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 };
      const first = !g.moved;
      g.moved = true;
      onChange((s) => ({ ...s, outline: s.outline.map((q, i) => (i === g.index ? p : q)) }), first);
      return;
    }
    if (g.kind === "opening") {
      const s = surfaceRef.current;
      const o = s.openings.find((o) => o.id === g.id);
      if (!o) return;
      if (!g.moved && dist(toScreen(viewRef.current, g.grab), sp) < 4) return;
      let x = snap(g.orig.x + wp.x - g.grab.x);
      let y = snap(g.orig.y + wp.y - g.grab.y);
      const b = bboxOf(s.outline);
      const tol = 10 / viewRef.current.s;
      if (Math.abs(x - b.minX) < tol) x = b.minX;
      if (Math.abs(x + o.w - b.maxX) < tol) x = b.maxX - o.w;
      if (Math.abs(y - b.minY) < tol) y = b.minY;
      if (Math.abs(y + o.h - b.maxY) < tol) y = b.maxY - o.h;
      if (s.kind === "wall" && o.kind === "door") y = b.minY;
      const first = !g.moved;
      g.moved = true;
      onChange(
        (s) => ({ ...s, openings: s.openings.map((q) => (q.id === g.id ? { ...q, x: round1(x), y: round1(y) } : q)) }),
        first
      );
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    const sp = localPoint(e);
    pointers.current.delete(e.pointerId);
    if (g?.kind === "pinch") {
      // reprise d'un panoramique avec le doigt restant
      const rest = [...pointers.current.values()][0];
      gesture.current = rest ? { kind: "pan", start: rest, view: viewRef.current, moved: true } : null;
      return;
    }
    if (pointers.current.size > 0) return;
    gesture.current = null;
    if (!g) return;
    if (g.kind === "draw" && !g.moved) {
      const wp = toWorld(viewRef.current, sp);
      const pts = drawRef.current;
      if (pts.length >= 3 && dist(toScreen(viewRef.current, pts[0]), sp) < 16) {
        onDrawComplete(pts);
        setDrawPts([]);
        return;
      }
      const p = snapDrawPoint(wp, pts);
      if (pts.length && dist(p, pts[pts.length - 1]) < 1) return;
      setDrawPts([...pts, p]);
      return;
    }
    if (g.kind === "pan" && !g.moved && tool === "select") {
      const wp = toWorld(viewRef.current, sp);
      if (!hitOpening(wp) && hitEdge(sp) < 0) onSelect({ edge: null, opening: null });
    }
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) gesture.current = null;
  };

  const cursor =
    tool === "paint" ? "crosshair" : tool === "move" ? "move" : tool === "draw" ? "crosshair" : "default";

  // aperçu du tracé en cours
  const drawPreview = (() => {
    if (tool !== "draw" || drawPts.length === 0) return null;
    const pts = drawPts.map((p) => toScreen(view, p));
    let ghost: Vec | null = null;
    if (hover) ghost = toScreen(view, snapDrawPoint(toWorld(view, hover), drawPts));
    const all = ghost ? [...pts, ghost] : pts;
    const segs: { a: Vec; b: Vec; l: number }[] = [];
    const wpts = ghost ? [...drawPts, toWorld(view, ghost)] : drawPts;
    for (let i = 1; i < wpts.length; i++) segs.push({ a: all[i - 1], b: all[i], l: dist(wpts[i - 1], wpts[i]) });
    return (
      <g pointerEvents="none">
        <polyline points={all.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#2563eb" strokeWidth={2.5} />
        {drawPts.length >= 3 && (
          <line x1={pts[pts.length - 1].x} y1={pts[pts.length - 1].y} x2={pts[0].x} y2={pts[0].y} stroke="#2563eb" strokeWidth={1} strokeDasharray="5 5" />
        )}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === 0 ? 8 : 5} fill={i === 0 ? "#fff" : "#2563eb"} stroke="#2563eb" strokeWidth={2} />
        ))}
        {segs.map((s, i) => (
          <text
            key={i}
            x={(s.a.x + s.b.x) / 2}
            y={(s.a.y + s.b.y) / 2 - 8}
            textAnchor="middle"
            fontSize={12}
            fontWeight={700}
            fill="#1d4ed8"
            stroke="#fff"
            strokeWidth={3}
            paintOrder="stroke"
          >
            {cm(s.l)}
          </text>
        ))}
      </g>
    );
  })();

  const originMarker = (() => {
    if (tool !== "move") return null;
    const p = toScreen(view, layout.origin);
    return (
      <g pointerEvents="none">
        <circle cx={p.x} cy={p.y} r={10} fill="none" stroke="#dc2626" strokeWidth={2} />
        <line x1={p.x - 16} y1={p.y} x2={p.x + 16} y2={p.y} stroke="#dc2626" strokeWidth={2} />
        <line x1={p.x} y1={p.y - 16} x2={p.x} y2={p.y + 16} stroke="#dc2626" strokeWidth={2} />
      </g>
    );
  })();

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden bg-[#fbfbfa]">
      {size.w > 0 && (
        <svg
          ref={svgRef}
          width={size.w}
          height={size.h}
          className="block select-none"
          style={{ touchAction: "none", cursor }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerLeave={() => setHover(null)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Grid view={view} w={size.w} h={size.h} />
          <Drawing
            surface={surface}
            layout={layout}
            view={view}
            idPrefix="vp"
            selection={selection}
            showCuts={showCuts}
            showCutLabels={showCutLabels}
            showDims={showDims}
          />
          {tool === "select" &&
            surface.outline.map((p, i) => {
              const sp = toScreen(view, p);
              return (
                <circle
                  key={i}
                  cx={sp.x}
                  cy={sp.y}
                  r={HANDLE_R - 2}
                  fill="#fff"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  pointerEvents="none"
                />
              );
            })}
          {originMarker}
          {drawPreview}
        </svg>
      )}
    </div>
  );
});

function Grid({ view, w, h }: { view: View; w: number; h: number }) {
  // pas de grille adapté au zoom : 10 cm, 50 cm ou 1 m
  const steps = [100, 500, 1000, 5000];
  const step = steps.find((s) => s * view.s >= 22) ?? 10000;
  const px = step * view.s;
  const ox = ((view.tx % px) + px) % px;
  const oy = ((view.ty % px) + px) % px;
  const lines: string[] = [];
  for (let x = ox; x < w; x += px) lines.push(`M${x.toFixed(1)} 0V${h}`);
  for (let y = oy; y < h; y += px) lines.push(`M0 ${y.toFixed(1)}H${w}`);
  return <path d={lines.join("")} stroke="#e7e5e4" strokeWidth={1} fill="none" pointerEvents="none" />;
}

function zoomAt(v: View, p: Vec, k: number): View {
  const s = Math.min(20, Math.max(0.005, v.s * k));
  const kk = s / v.s;
  return { s, tx: p.x - (p.x - v.tx) * kk, ty: p.y - (p.y - v.ty) * kk };
}

const mid = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const round1 = (n: number) => Math.round(n * 10) / 10;

function distToSegment(p: Vec, a: Vec, b: Vec) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
