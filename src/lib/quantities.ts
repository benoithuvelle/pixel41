import type { Surface } from "@/types";
import { groutKg, type LayoutResult } from "./layout";
import { PATTERN_LABELS } from "./patterns";
import { cm } from "./format";

export interface FormatOrder {
  format: number;
  label: string;
  laid: number;
  full: number;
  cut: number;
  order: number;
  boxes: number | null;
  area: number;
}

export interface Quantities {
  zoneM2: number;
  full: number;
  cut: number;
  small: number;
  total: number;
  formats: FormatOrder[];
  orderTiles: number;
  orderM2: number;
  boxes: number | null;
  cost: number | null;
  groutKg: number;
  colors: { color: string; laid: number; order: number }[];
}

/** Quantités à commander pour une surface. */
export function quantities(surface: Surface, layout: LayoutResult): Quantities {
  const k = 1 + Math.max(0, surface.margin) / 100;
  const multi = layout.def.formats.length > 1;
  const formats: FormatOrder[] = layout.def.formats.map((f, i) => {
    const pf = layout.perFormat[i];
    const order = Math.ceil(pf.total * k);
    const boxes = !multi && surface.tile.perBox > 0 ? Math.ceil(order / surface.tile.perBox) : null;
    return { format: i, label: f.label, laid: pf.total, full: pf.full, cut: pf.cut, order, boxes, area: f.area };
  });
  const orderTiles = formats.reduce((s, f) => s + f.order, 0);
  const tilesArea = formats.reduce((s, f) => s + f.order * f.area, 0) / 1e6;
  // vente au m² : on commande la surface couverte (joints inclus) + marge, arrondie au carton si connu
  const boxes = formats.length === 1 ? formats[0].boxes : null;
  const orderM2 =
    boxes !== null && boxes > 0
      ? (boxes * surface.tile.perBox * layout.def.formats[0].area) / 1e6
      : multi
        ? (layout.zoneArea / 1e6) * k
        : tilesArea;
  const cost = surface.tile.pricePerM2 > 0 ? orderM2 * surface.tile.pricePerM2 : null;
  const zoneM2 = layout.zoneArea / 1e6;
  const base = layout.def.formats[0];
  const grout =
    surface.pattern.type === "hexagon"
      ? groutKg(zoneM2, base.h, base.h, surface.tile.joint, surface.tile.thickness) * 1.15
      : groutKg(zoneM2, base.w, base.h, surface.tile.joint, surface.tile.thickness);
  const colors = surface.colors.palette
    .map((color, i) => ({ color, laid: layout.perColor[i] ?? 0, order: Math.ceil((layout.perColor[i] ?? 0) * k) }))
    .filter((c) => c.laid > 0);
  return {
    zoneM2,
    full: layout.full,
    cut: layout.cut,
    small: layout.small,
    total: layout.total,
    formats,
    orderTiles,
    orderM2,
    boxes,
    cost,
    groutKg: grout,
    colors,
  };
}

export function patternSummary(s: Surface): string {
  const p = s.pattern;
  let t = PATTERN_LABELS[p.type];
  if (p.type === "offset") {
    const r = p.offsetRatio;
    const frac =
      Math.abs(r - 0.5) < 1e-6 ? "1/2" : Math.abs(r - 1 / 3) < 1e-6 ? "1/3" : Math.abs(r - 0.25) < 1e-6 ? "1/4" : `${Math.round(r * 100)} %`;
    t += ` ${frac}${p.offsetDir === "cols" ? " (colonnes)" : ""}`;
  }
  if (p.type === "chevron") t += ` ${p.chevronAngle}°`;
  if (s.layout.angle) t += `, orienté à ${s.layout.angle}°`;
  return t;
}

export function tileSummary(s: Surface): string {
  const t = s.tile;
  if (s.pattern.type === "hexagon") return `Hexagone ${cm(t.w)} cm, joint ${t.joint} mm`;
  if (s.pattern.type === "opus") return `Opus module ${cm(t.w)} cm, joint ${t.joint} mm`;
  if (s.pattern.type === "pinwheel") return `${cm(t.w)} × ${cm(t.w)} + ${cm(s.pattern.smallSize)} × ${cm(s.pattern.smallSize)} cm, joint ${t.joint} mm`;
  return `${cm(t.w)} × ${cm(t.h)} cm, joint ${t.joint} mm`;
}

export function alignSummary(s: Surface): string {
  const wall = s.kind === "wall";
  const x = { start: "à gauche", center: "centré", joint: "joint centré", end: "à droite" }[s.layout.alignX];
  const y = { start: wall ? "depuis le sol" : "en bas", center: "centré", joint: "joint centré", end: "en haut" }[s.layout.alignY];
  let t = `Départ ${x} / ${y}`;
  if (s.layout.offsetX || s.layout.offsetY) t += ` (décalage ${cm(s.layout.offsetX)} ; ${cm(s.layout.offsetY)} cm)`;
  return t;
}
