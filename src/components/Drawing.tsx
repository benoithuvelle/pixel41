import { memo, useMemo, type ReactElement } from "react";
import type { Opening, Surface, Vec } from "@/types";
import type { LayoutResult } from "@/lib/layout";
import { bboxOf, centroid, norm, offsetRing, signedArea, sub } from "@/lib/geometry";
import { toScreen, WALL_T, type DrawingOptions, type Selection, type View } from "@/lib/view";
import { cm } from "@/lib/format";

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
const INK = "#27272a";
const DIM = "#52525b";
const ACCENT = "#2563eb";

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Assombrit (k<0) ou éclaircit (k>0) une couleur hexadécimale. */
function shade(hex: string, k: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (c: number) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k);
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function polyPath(poly: Vec[]): string {
  let s = `M${r1(poly[0].x)} ${r1(poly[0].y)}`;
  for (let i = 1; i < poly.length; i++) s += `L${r1(poly[i].x)} ${r1(poly[i].y)}`;
  return s + "Z";
}


interface Props extends DrawingOptions {
  surface: Surface;
  layout: LayoutResult;
  view: View;
  idPrefix: string;
  selection?: Selection;
}

/** Dessin d'une surface : murs, carreaux, coupes, ouvertures et cotes. */
export const Drawing = memo(function Drawing({
  surface,
  layout,
  view,
  idPrefix,
  selection,
  showCuts,
  showCutLabels,
  showDims,
}: Props) {
  const palette = surface.colors.palette;
  const jointColor = surface.tile.jointColor;
  const isFloor = surface.kind === "floor";

  const zonePath = useMemo(() => layout.zone.flatMap((p) => p.map(polyPath)).join(""), [layout.zone]);
  const outlinePath = useMemo(() => (surface.outline.length >= 3 ? polyPath(surface.outline) : ""), [surface.outline]);
  const wallPath = useMemo(() => {
    if (!isFloor || surface.outline.length < 3) return "";
    const outer = offsetRing(surface.outline, WALL_T);
    return polyPath(outer) + polyPath(surface.outline);
  }, [isFloor, surface.outline]);

  const tilePaths = useMemo(() => {
    const byColor = new Map<number, string[]>();
    const cuts: string[] = [];
    const smalls: string[] = [];
    for (const t of layout.tiles) {
      let arr = byColor.get(t.color);
      if (!arr) byColor.set(t.color, (arr = []));
      arr.push(polyPath(t.poly));
      if (t.status === "cut" && t.pieces) {
        const d = t.pieces.flatMap((p) => p.map(polyPath)).join("");
        (t.small ? smalls : cuts).push(d);
      }
    }
    return {
      colors: [...byColor.entries()].map(([c, arr]) => ({ color: c, d: arr.join("") })),
      cuts: cuts.join(""),
      smalls: smalls.join(""),
    };
  }, [layout.tiles]);

  const matrix = `matrix(${view.s},0,0,${-view.s},${view.tx},${view.ty})`;
  const hairline = surface.tile.joint * view.s < 1.2;
  const clipId = `${idPrefix}-clip`;
  const b = bboxOf(surface.outline);

  return (
    <g fontFamily={FONT}>
      <g transform={matrix}>
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <path d={zonePath} clipRule="evenodd" />
          </clipPath>
          {/* hachures à espacement constant à l'écran */}
          <pattern id={`${idPrefix}-hatch`} patternUnits="userSpaceOnUse" width={7 / view.s} height={7 / view.s} patternTransform="rotate(45)">
            <rect width={7 / view.s} height={7 / view.s} fill="#2563eb" fillOpacity={0.07} />
            <line x1={0} y1={0} x2={0} y2={7 / view.s} stroke="#2563eb" strokeOpacity={0.55} strokeWidth={1.4 / view.s} />
          </pattern>
          <pattern id={`${idPrefix}-hatch-red`} patternUnits="userSpaceOnUse" width={5 / view.s} height={5 / view.s} patternTransform="rotate(45)">
            <rect width={5 / view.s} height={5 / view.s} fill="#dc2626" fillOpacity={0.3} />
            <line x1={0} y1={0} x2={0} y2={5 / view.s} stroke="#b91c1c" strokeOpacity={0.85} strokeWidth={1.6 / view.s} />
          </pattern>
        </defs>
        {!isFloor && (
          <g>
            <rect x={b.minX - 400} y={-90} width={b.maxX - b.minX + 800} height={90} fill="#d4d4d8" />
            <line x1={b.minX - 400} y1={0} x2={b.maxX + 400} y2={0} stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </g>
        )}
        <path d={outlinePath} fill={isFloor ? "#f4f4f5" : "#e7e4de"} />
        {wallPath && <path d={wallPath} fill="#3f3f46" fillRule="evenodd" />}
        <path d={zonePath} fill={jointColor} fillRule="evenodd" />
        <g clipPath={`url(#${clipId})`}>
          {tilePaths.colors.map(({ color, d }) => {
            const fill = palette[color] ?? palette[0] ?? "#dddddd";
            // joints trop fins pour être visibles à ce zoom : trait fin pour garder le calepinage lisible
            return (
              <path
                key={color}
                d={d}
                fill={fill}
                stroke={hairline ? shade(fill, -0.32) : "none"}
                strokeWidth={hairline ? 0.7 : 0}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </g>
        {showCuts && tilePaths.cuts && <path d={tilePaths.cuts} fill={`url(#${idPrefix}-hatch)`} fillRule="evenodd" />}
        {showCuts && tilePaths.smalls && <path d={tilePaths.smalls} fill={`url(#${idPrefix}-hatch-red)`} fillRule="evenodd" />}
        {surface.openings.map((o) => (
          <OpeningShape key={o.id} o={o} isFloor={isFloor} selected={selection?.opening === o.id} />
        ))}
        <path d={outlinePath} fill="none" stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        {!isFloor && surface.band && <BandLines surface={surface} />}
      </g>
      {showDims && <EdgeDims surface={surface} view={view} selectedEdge={selection?.edge ?? null} />}
      {showDims && <OpeningLabels surface={surface} view={view} />}
      {showDims && !isFloor && surface.band && <BandLabels surface={surface} view={view} />}
      {showCutLabels && <CutLabels layout={layout} view={view} />}
    </g>
  );
});

function OpeningShape({ o, isFloor, selected }: { o: Opening; isFloor: boolean; selected: boolean }) {
  const stroke = selected ? ACCENT : INK;
  const sw = selected ? 2.5 : 1.2;
  const common = { vectorEffect: "non-scaling-stroke" as const };
  if (!isFloor && o.kind === "door") {
    const inset = Math.min(60, o.w * 0.08);
    return (
      <g>
        <rect x={o.x} y={o.y} width={o.w} height={o.h} fill="#fafafa" stroke={stroke} strokeWidth={sw} {...common} />
        <rect
          x={o.x + inset}
          y={o.y}
          width={Math.max(0, o.w - 2 * inset)}
          height={Math.max(0, o.h - inset)}
          fill="none"
          stroke="#a1a1aa"
          strokeWidth={1}
          {...common}
        />
        <circle cx={o.x + o.w - inset * 2.2} cy={o.y + Math.min(1000, o.h * 0.5)} r={Math.max(12, o.w * 0.025)} fill="#71717a" />
      </g>
    );
  }
  if (!isFloor && o.kind === "window") {
    return (
      <g>
        <rect x={o.x} y={o.y} width={o.w} height={o.h} fill="#e0f2fe" stroke={stroke} strokeWidth={sw} {...common} />
        <line x1={o.x + o.w / 2} y1={o.y} x2={o.x + o.w / 2} y2={o.y + o.h} stroke="#7dd3fc" strokeWidth={1.5} {...common} />
        <line x1={o.x} y1={o.y + o.h * 0.5} x2={o.x + o.w} y2={o.y + o.h * 0.5} stroke="#7dd3fc" strokeWidth={1} {...common} />
      </g>
    );
  }
  return (
    <g>
      <rect x={o.x} y={o.y} width={o.w} height={o.h} fill="#e4e4e7" stroke={stroke} strokeWidth={sw} {...common} />
      <line x1={o.x} y1={o.y} x2={o.x + o.w} y2={o.y + o.h} stroke="#a1a1aa" strokeWidth={1} {...common} />
      <line x1={o.x + o.w} y1={o.y} x2={o.x} y2={o.y + o.h} stroke="#a1a1aa" strokeWidth={1} {...common} />
    </g>
  );
}

function BandLines({ surface }: { surface: Surface }) {
  const b = bboxOf(surface.outline);
  const band = surface.band!;
  const ys = [band.from, band.to].filter((y) => y > b.minY + 0.5 && y < b.maxY - 0.5);
  return (
    <g>
      {ys.map((y) => (
        <line
          key={y}
          x1={b.minX}
          x2={b.maxX}
          y1={y}
          y2={y}
          stroke="#0f766e"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}

function BandLabels({ surface, view }: { surface: Surface; view: View }) {
  const b = bboxOf(surface.outline);
  const band = surface.band!;
  const items = [
    { y: band.to, t: `↑ ${cm(band.to)}` },
    { y: band.from, t: `↓ ${cm(band.from)}` },
  ].filter((i) => i.y > b.minY + 0.5 && i.y < b.maxY - 0.5);
  return (
    <g>
      {items.map((i) => {
        const p = toScreen(view, { x: b.maxX, y: i.y });
        return (
          <text key={i.y} x={p.x - 6} y={p.y - 5} textAnchor="end" fontSize={11} fontWeight={600} fill="#0f766e" stroke="#fff" strokeWidth={3} paintOrder="stroke">
            {i.t}
          </text>
        );
      })}
    </g>
  );
}

function dimLine(a: Vec, b: Vec, n: Vec, offset: number, text: string, key: string | number, color = DIM, bold = false) {
  const pa = { x: a.x + n.x * offset, y: a.y + n.y * offset };
  const pb = { x: b.x + n.x * offset, y: b.y + n.y * offset };
  const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
  let ang = (Math.atan2(pb.y - pa.y, pb.x - pa.x) * 180) / Math.PI;
  if (ang > 90) ang -= 180;
  if (ang <= -90) ang += 180;
  const dir = norm(sub(pb, pa));
  const tick = (p: Vec) => {
    const tx = (dir.x - dir.y) * 4;
    const ty = (dir.y + dir.x) * 4;
    return <line x1={p.x - tx} y1={p.y - ty} x2={p.x + tx} y2={p.y + ty} stroke={color} strokeWidth={1.2} />;
  };
  const ext = offset + 4;
  return (
    <g key={key}>
      <line x1={a.x + n.x * 3} y1={a.y + n.y * 3} x2={a.x + n.x * ext} y2={a.y + n.y * ext} stroke={color} strokeWidth={0.6} opacity={0.6} />
      <line x1={b.x + n.x * 3} y1={b.y + n.y * 3} x2={b.x + n.x * ext} y2={b.y + n.y * ext} stroke={color} strokeWidth={0.6} opacity={0.6} />
      <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={color} strokeWidth={bold ? 1.6 : 0.9} />
      {tick(pa)}
      {tick(pb)}
      <text
        x={mid.x + n.x * 2}
        y={mid.y + n.y * 2}
        transform={`rotate(${ang} ${mid.x + n.x * 2} ${mid.y + n.y * 2})`}
        textAnchor="middle"
        dy={n.y > 0.5 ? "1em" : "-0.35em"}
        fontSize={12}
        fontWeight={bold ? 700 : 600}
        fill={color}
        stroke="#fff"
        strokeWidth={3}
        paintOrder="stroke"
      >
        {text}
      </text>
    </g>
  );
}

function EdgeDims({ surface, view, selectedEdge }: { surface: Surface; view: View; selectedEdge: number | null }) {
  const pts = surface.outline;
  if (pts.length < 3) return null;
  const ccw = signedArea(pts) > 0;
  const base = surface.kind === "floor" ? WALL_T * view.s : 0;
  return (
    <g>
      {pts.map((a, i) => {
        const b = pts[(i + 1) % pts.length];
        const sa = toScreen(view, a);
        const sb = toScreen(view, b);
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const slen = Math.hypot(sb.x - sa.x, sb.y - sa.y);
        if (slen < 26 && selectedEdge !== i) return null;
        const d = norm(sub(b, a));
        // normale extérieure (repère monde) puis écran (y inversé)
        const nw = ccw ? { x: d.y, y: -d.x } : { x: -d.y, y: d.x };
        const n = { x: nw.x, y: -nw.y };
        const sel = selectedEdge === i;
        return dimLine(sa, sb, n, base + 18, cm(len), i, sel ? ACCENT : DIM, sel);
      })}
    </g>
  );
}

function OpeningLabels({ surface, view }: { surface: Surface; view: View }) {
  const b = bboxOf(surface.outline);
  return (
    <g>
      {surface.openings.map((o) => {
        const p1 = toScreen(view, { x: o.x, y: o.y + o.h });
        const p2 = toScreen(view, { x: o.x + o.w, y: o.y });
        const w = p2.x - p1.x;
        const h = p2.y - p1.y;
        if (w < 40 || h < 22) return null;
        const lines = [o.label, `${cm(o.w)} × ${cm(o.h)}`];
        if (surface.kind === "wall") {
          if (h > 60) lines.push(`à ${cm(o.x - b.minX)} du bord`);
          if (o.y - b.minY > 0.5 && h > 74) lines.push(`${o.kind === "window" ? "allège" : "à"} ${cm(o.y - b.minY)} du sol`);
        } else if (h > 60) {
          lines.push(`x ${cm(o.x - b.minX)} · y ${cm(o.y - b.minY)}`);
        }
        const fs = Math.min(12, Math.max(9, w / 9));
        const maxLines = Math.max(1, Math.floor(h / (fs * 1.3)));
        const shown = lines.slice(0, maxLines);
        const cy = (p1.y + p2.y) / 2 - ((shown.length - 1) * fs * 1.25) / 2;
        return (
          <g key={o.id}>
            {shown.map((t, i) => (
              <text
                key={i}
                x={(p1.x + p2.x) / 2}
                y={cy + i * fs * 1.25}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={fs}
                fontWeight={i === 0 ? 700 : 500}
                fill={INK}
                stroke="#fff"
                strokeWidth={2.5}
                paintOrder="stroke"
              >
                {t}
              </text>
            ))}
          </g>
        );
      })}
    </g>
  );
}

function CutLabels({ layout, view }: { layout: LayoutResult; view: View }) {
  const out: ReactElement[] = [];
  for (const t of layout.tiles) {
    if (t.status !== "cut" || !t.pieces || !t.rectCut) continue;
    const ring = t.pieces[0][0];
    const sp = ring.map((p) => toScreen(view, p));
    const bb = bboxOf(sp);
    const sw = bb.maxX - bb.minX;
    const sh = bb.maxY - bb.minY;
    if (Math.min(sw, sh) < 16 || Math.max(sw, sh) < 24) continue;
    const m = layout.def.motif[t.k];
    const dw = Math.abs(t.cutW - m.fw) > 0.6;
    const dh = Math.abs(t.cutH - m.fh) > 0.6;
    const text = dw && dh ? `${cm(t.cutW)}×${cm(t.cutH)}` : dw ? cm(t.cutW) : cm(t.cutH);
    const c = centroid(sp);
    // choisit une orientation et une taille qui tiennent dans la coupe, sinon pas d'étiquette
    let fs = Math.min(12, Math.max(8, Math.min(sw, sh) / 2.4));
    const fitsH = (f: number) => text.length * f * 0.6 <= sw - 4 && f * 1.15 <= sh;
    const fitsV = (f: number) => text.length * f * 0.6 <= sh - 4 && f * 1.15 <= sw;
    let vertical = false;
    if (!fitsH(fs)) {
      if (fitsV(fs)) vertical = true;
      else if (fitsH(8)) fs = 8;
      else if (fitsV(8)) {
        fs = 8;
        vertical = true;
      } else continue;
    }
    out.push(
      <text
        key={t.key}
        x={c.x}
        y={c.y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fs}
        fontWeight={700}
        fill={t.small ? "#991b1b" : "#1e3a8a"}
        stroke="#fff"
        strokeWidth={2.5}
        paintOrder="stroke"
        transform={vertical ? `rotate(-90 ${c.x} ${c.y})` : undefined}
      >
        {text}
      </text>
    );
    if (out.length > 600) break;
  }
  return <g>{out}</g>;
}
