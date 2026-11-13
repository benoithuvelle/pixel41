import type { PatternSpec, PatternType, TileSpec, Vec } from "@/types";
import { bboxOf, centroid, deg2rad, rotate, type BBox } from "./geometry";

/** Un carreau du motif élémentaire (coordonnées du motif). */
export interface MotifTile {
  poly: Vec[];
  format: number;
  /** repère propre au carreau (pour mesurer les coupes) */
  center: Vec;
  angle: number;
  /** dimensions du carreau dans son repère propre */
  fw: number;
  fh: number;
}

export interface Format {
  w: number;
  h: number;
  area: number;
  label: string;
}

export interface PatternDef {
  v1: Vec;
  v2: Vec;
  motif: MotifTile[];
  formats: Format[];
  warnings: string[];
  /** boîte englobante du carreau de référence (motif[0]) */
  anchor: BBox;
  /** boîte englobante de tout le motif */
  motifBox: BBox;
}

/** Au-delà, l'affichage est tronqué (mosaïque trop fine pour la surface). */
export const MAX_TILES = 60000;

export interface GeneratedTile {
  i: number;
  j: number;
  k: number;
  poly: Vec[];
}

export const PATTERN_LABELS: Record<PatternType, string> = {
  grid: "Droit",
  offset: "Décalé",
  herringbone: "Bâtons rompus",
  chevron: "Chevron",
  basket: "Vannerie",
  hexagon: "Hexagone",
  pinwheel: "Moulinet",
  opus: "Opus romain",
};

export const PATTERN_HINTS: Record<PatternType, string> = {
  grid: "Joints alignés dans les deux sens",
  offset: "Rangées décalées (coupe de pierre, ½, ⅓...)",
  herringbone: "Point de Hongrie à angle droit (parquet)",
  chevron: "Lames à bouts biais formant des V",
  basket: "Paires de lames alternées (tissage)",
  hexagon: "Tomettes / hexagones",
  pinwheel: "Grand carré + petit cabochon",
  opus: "4 formats (1×1, 2×1, 2×2, 3×2 modules)",
};

const fmtCm = (mm: number) => {
  const cm = Math.round(mm) / 10;
  return Number.isInteger(cm) ? `${cm}` : cm.toFixed(1).replace(".", ",");
};

function rectTile(x: number, y: number, w: number, h: number, format: number, vertical = false): MotifTile {
  const poly = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
  return {
    poly,
    format,
    center: { x: x + w / 2, y: y + h / 2 },
    angle: vertical ? Math.PI / 2 : 0,
    fw: vertical ? h : w,
    fh: vertical ? w : h,
  };
}

function polyTile(poly: Vec[], format: number, angle: number): MotifTile {
  const c = centroid(poly);
  const local = poly.map((p) => rotate({ x: p.x - c.x, y: p.y - c.y }, -angle));
  const b = bboxOf(local);
  return { poly, format, center: c, angle, fw: b.maxX - b.minX, fh: b.maxY - b.minY };
}

function fmt(w: number, h: number, label?: string): Format {
  return { w, h, area: w * h, label: label ?? `${fmtCm(w)} × ${fmtCm(h)}` };
}

/** Formats utilisés par l'opus (en modules : largeur × hauteur). */
export const OPUS_UNITS: [number, number][] = [
  [1, 1],
  [2, 1],
  [2, 2],
  [3, 2],
];

export function buildPattern(tile: TileSpec, spec: PatternSpec): PatternDef {
  const j = Math.max(0, tile.joint);
  const w = Math.max(1, tile.w);
  const h = Math.max(1, tile.h);
  const L = Math.max(w, h);
  const W = Math.min(w, h);
  const warnings: string[] = [];
  let v1: Vec;
  let v2: Vec;
  let motif: MotifTile[];
  let formats: Format[];

  switch (spec.type) {
    case "offset": {
      const r = clampRatio(spec.offsetRatio);
      formats = [fmt(w, h)];
      motif = [rectTile(0, 0, w, h, 0)];
      if (spec.offsetDir === "cols") {
        v1 = { x: 0, y: h + j };
        v2 = { x: w + j, y: r * (h + j) };
      } else {
        v1 = { x: w + j, y: 0 };
        v2 = { x: r * (w + j), y: h + j };
      }
      break;
    }
    case "herringbone": {
      const a = L + j;
      const b = W + j;
      formats = [fmt(L, W)];
      motif = [rectTile(0, 0, L, W, 0), rectTile(a, b - a, W, L, 0, true)];
      v1 = { x: b, y: b };
      v2 = { x: a, y: -a };
      if (L < W * 1.5) warnings.push("Le bâton rompu nécessite des lames nettement plus longues que larges.");
      break;
    }
    case "basket": {
      const k = Math.max(1, Math.round((L + j) / (W + j)));
      const B = Math.max(L + j, k * (W + j));
      if (Math.abs(L + j - k * (W + j)) > 0.5) {
        warnings.push(
          `Format peu adapté à la vannerie : ${k} lames de ${fmtCm(W)} cm + joints ≠ ${fmtCm(L)} cm (écart ${fmtCm(Math.abs(L + j - k * (W + j)))} cm).`
        );
      }
      formats = [fmt(L, W)];
      motif = [];
      for (let m = 0; m < k; m++) motif.push(rectTile(0, m * (W + j), L, W, 0));
      for (let m = 0; m < k; m++) motif.push(rectTile(B + m * (W + j), 0, W, L, 0, true));
      v1 = { x: 2 * B, y: 0 };
      v2 = { x: B, y: B };
      break;
    }
    case "chevron": {
      const alpha = deg2rad(Math.min(70, Math.max(20, spec.chevronAngle || 45)));
      const cw = L * Math.cos(alpha);
      const rise = L * Math.sin(alpha);
      const hEnd = W / Math.cos(alpha);
      const p = (W + j) / Math.cos(alpha);
      const c = cw + j;
      formats = [fmt(L, W, `${fmtCm(L)} × ${fmtCm(W)} (${Math.round((alpha * 180) / Math.PI)}°)`)];
      motif = [
        polyTile(
          [
            { x: 0, y: 0 },
            { x: cw, y: rise },
            { x: cw, y: rise + hEnd },
            { x: 0, y: hEnd },
          ],
          0,
          alpha
        ),
        polyTile(
          [
            { x: c, y: rise },
            { x: c + cw, y: 0 },
            { x: c + cw, y: hEnd },
            { x: c, y: rise + hEnd },
          ],
          0,
          -alpha
        ),
      ];
      v1 = { x: 2 * c, y: 0 };
      v2 = { x: 0, y: p };
      break;
    }
    case "hexagon": {
      const d = w; // largeur plat à plat
      const D = d + j;
      const R = d / Math.sqrt(3);
      const Rp = D / Math.sqrt(3);
      const poly: Vec[] = [];
      for (let a = 0; a < 6; a++) {
        const t = (a * Math.PI) / 3;
        poly.push({ x: R * Math.cos(t), y: R * Math.sin(t) });
      }
      formats = [fmt(2 * R, d, `Hexagone ${fmtCm(d)} (plat à plat)`)];
      formats[0].area = (3 * Math.sqrt(3) * R * R) / 2;
      motif = [polyTile(poly, 0, 0)];
      v1 = { x: 1.5 * Rp, y: D / 2 };
      v2 = { x: 0, y: D };
      break;
    }
    case "pinwheel": {
      const a = w;
      const s = Math.min(Math.max(1, spec.smallSize || a / 2), a - 1);
      const A = a + j;
      const S = s + j;
      formats = [fmt(a, a), fmt(s, s)];
      motif = [rectTile(0, 0, a, a, 0), rectTile(A, 0, s, s, 1)];
      v1 = { x: A, y: S };
      v2 = { x: -S, y: A };
      break;
    }
    case "opus": {
      // module = petit carreau + joint ; un format de n modules mesure n*U - joint
      const U = w + j;
      const sz = (n: number) => n * U - j;
      formats = OPUS_UNITS.map(([a, b]) => fmt(sz(a), sz(b)));
      const T = (x: number, y: number, a: number, b: number, f: number) =>
        rectTile(x * U, y * U, sz(a), sz(b), f, false);
      // agencement calculé par recherche exhaustive (tore 5×5, joints continus ≤ 3 modules en x)
      motif = [
        T(0, 0, 3, 2, 3),
        T(3, -2, 2, 3, 3),
        T(3, 1, 2, 2, 2),
        T(0, 2, 1, 1, 0),
        T(1, 2, 2, 2, 2),
        T(3, 3, 1, 2, 1),
        T(1, 4, 2, 1, 1),
      ];
      // les formats verticaux sont mesurés dans le repère du carreau
      motif = motif.map((m) => {
        if (m.fh > m.fw) return { ...m, angle: Math.PI / 2, fw: m.fh, fh: m.fw };
        return m;
      });
      v1 = { x: 5 * U, y: 0 };
      v2 = { x: U, y: 5 * U };
      break;
    }
    case "grid":
    default: {
      formats = [fmt(w, h)];
      motif = [rectTile(0, 0, w, h, 0)];
      v1 = { x: w + j, y: 0 };
      v2 = { x: 0, y: h + j };
      break;
    }
  }

  const anchor = bboxOf(motif[0].poly);
  const motifBox = bboxOf(motif.flatMap((m) => m.poly));
  return { v1, v2, motif, formats, warnings, anchor, motifBox };
}

function clampRatio(r: number) {
  if (!Number.isFinite(r)) return 0.5;
  return Math.min(0.95, Math.max(0, r));
}

/** Génère tous les carreaux du motif susceptibles de toucher la région (coordonnées du motif). */
export function generateTiles(def: PatternDef, region: BBox): GeneratedTile[] {
  const { v1, v2, motif, motifBox } = def;
  const det = v1.x * v2.y - v1.y * v2.x;
  if (Math.abs(det) < 1e-9) return [];
  // origine de cellule admissible : region ⊖ motifBox
  const ex = {
    minX: region.minX - motifBox.maxX,
    maxX: region.maxX - motifBox.minX,
    minY: region.minY - motifBox.maxY,
    maxY: region.maxY - motifBox.minY,
  };
  const toLattice = (x: number, y: number) => ({
    i: (x * v2.y - y * v2.x) / det,
    j: (v1.x * y - v1.y * x) / det,
  });
  const corners = [
    toLattice(ex.minX, ex.minY),
    toLattice(ex.maxX, ex.minY),
    toLattice(ex.minX, ex.maxY),
    toLattice(ex.maxX, ex.maxY),
  ];
  const iMin = Math.floor(Math.min(...corners.map((c) => c.i))) - 1;
  const iMax = Math.ceil(Math.max(...corners.map((c) => c.i))) + 1;
  const jMin = Math.floor(Math.min(...corners.map((c) => c.j))) - 1;
  const jMax = Math.ceil(Math.max(...corners.map((c) => c.j))) + 1;

  const boxes = motif.map((m) => bboxOf(m.poly));
  const out: GeneratedTile[] = [];
  const limit = MAX_TILES;
  for (let i = iMin; i <= iMax; i++) {
    for (let jj = jMin; jj <= jMax; jj++) {
      const ox = i * v1.x + jj * v2.x;
      const oy = i * v1.y + jj * v2.y;
      if (ox + motifBox.maxX < region.minX || ox + motifBox.minX > region.maxX) continue;
      if (oy + motifBox.maxY < region.minY || oy + motifBox.minY > region.maxY) continue;
      for (let k = 0; k < motif.length; k++) {
        const b = boxes[k];
        if (ox + b.maxX < region.minX || ox + b.minX > region.maxX) continue;
        if (oy + b.maxY < region.minY || oy + b.minY > region.maxY) continue;
        out.push({
          i,
          j: jj,
          k,
          poly: motif[k].poly.map((p) => ({ x: p.x + ox, y: p.y + oy })),
        });
      }
      if (out.length > limit) return out;
    }
  }
  return out;
}
