import polygonClipping, { type MultiPolygon as PCMulti, type Polygon as PCPoly } from "polygon-clipping";
import type { Align, ColorSpec, Surface, Vec } from "@/types";
import {
  bboxOf,
  bboxOverlap,
  centroid,
  cleanRing,
  deg2rad,
  pointInRings,
  ringArea,
  rotate,
  segmentsIntersect,
  type BBox,
  type Ring,
} from "./geometry";
import { buildPattern, generateTiles, MAX_TILES, type PatternDef } from "./patterns";

/** Polygone avec trous : [contour, ...trous] */
export type Poly = Ring[];

export type TileStatus = "full" | "cut";

export interface LaidTile {
  key: string;
  i: number;
  j: number;
  k: number;
  format: number;
  color: number;
  poly: Vec[];
  status: TileStatus;
  pieces?: Poly[];
  /** fraction de surface conservée */
  ratio: number;
  /** dimensions de la coupe dans le repère du carreau */
  cutW: number;
  cutH: number;
  rectCut: boolean;
  small: boolean;
  /** repère du carreau (monde) */
  center: Vec;
  angle: number;
}

export interface CutGroup {
  format: number;
  w: number;
  h: number;
  rect: boolean;
  small: boolean;
  count: number;
}

export interface FormatStats {
  format: number;
  full: number;
  cut: number;
  total: number;
}

export interface LayoutResult {
  def: PatternDef;
  zone: Poly[];
  zoneRings: Ring[];
  zoneArea: number;
  zoneBox: BBox;
  tiles: LaidTile[];
  full: number;
  cut: number;
  small: number;
  total: number;
  perFormat: FormatStats[];
  perColor: number[];
  cutGroups: CutGroup[];
  /** origine du motif dans le repère monde */
  origin: Vec;
  angle: number;
  truncated: boolean;
}

const toPairs = (ring: Ring): [number, number][] => ring.map((p) => [p.x, p.y]);
const fromPairs = (ring: [number, number][]): Ring => {
  const r = ring.map(([x, y]) => ({ x, y }));
  if (r.length > 1 && r[0].x === r[r.length - 1].x && r[0].y === r[r.length - 1].y) r.pop();
  return r;
};

export function polyArea(p: Poly): number {
  if (!p.length) return 0;
  let a = ringArea(p[0]);
  for (let i = 1; i < p.length; i++) a -= ringArea(p[i]);
  return a;
}

/** Surface carrelable : contour ∩ bande − ouvertures. */
export function computeZone(surface: Surface): Poly[] {
  const outline = cleanRing(surface.outline);
  if (outline.length < 3) return [];
  let geom: PCMulti = [[toPairs(outline)]];
  try {
    geom = polygonClipping.union(geom as PCMulti);
    if (surface.kind === "wall" && surface.band) {
      const b = bboxOf(outline);
      const from = Math.min(surface.band.from, surface.band.to);
      const to = Math.max(surface.band.from, surface.band.to);
      const rect: PCPoly = [
        [
          [b.minX - 10, from],
          [b.maxX + 10, from],
          [b.maxX + 10, to],
          [b.minX - 10, to],
        ],
      ];
      geom = polygonClipping.intersection(geom, rect);
    }
    const holes: PCPoly[] = surface.openings
      .filter((o) => o.w > 0 && o.h > 0)
      .map((o) => [
        [
          [o.x, o.y],
          [o.x + o.w, o.y],
          [o.x + o.w, o.y + o.h],
          [o.x, o.y + o.h],
        ],
      ]);
    if (holes.length) geom = polygonClipping.difference(geom, ...holes);
  } catch (e) {
    console.warn("zone", e);
    return [[outline]];
  }
  return geom.map((poly) => poly.map(fromPairs));
}

function hash3(i: number, j: number, k: number, seed: number) {
  let h = (i * 374761393 + j * 668265263 + k * 2147483647 + seed * 144665) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

export function tileColor(colors: ColorSpec, i: number, j: number, k: number, motifCount: number, key: string): number {
  const n = Math.max(1, colors.palette.length);
  const painted = colors.paint[key];
  if (painted !== undefined && painted < n) return painted;
  switch (colors.mode) {
    case "checker":
      return mod(i + j + (motifCount > 1 ? k : 0), n);
    case "rows":
      return mod(j, n);
    case "cols":
      return mod(i, n);
    case "random": {
      const weights = colors.palette.map((_, idx) => Math.max(0, colors.weights[idx] ?? 1));
      const total = weights.reduce((a, b) => a + b, 0);
      if (total <= 0) return 0;
      let r = hash3(i, j, k, colors.seed) * total;
      for (let idx = 0; idx < n; idx++) {
        r -= weights[idx];
        if (r < 0) return idx;
      }
      return n - 1;
    }
    default:
      return 0;
  }
}

function alignCoord(align: Align, min: number, max: number, aMin: number, aMax: number, joint: number) {
  switch (align) {
    case "end":
      return max - aMax;
    case "center":
      return (min + max) / 2 - (aMin + aMax) / 2;
    case "joint":
      return (min + max) / 2 - (aMax + joint / 2);
    default:
      return min - aMin;
  }
}

/** Origine du motif dans le repère tourné (avant rotation). */
export function patternOrigin(surface: Surface, def: PatternDef, zoneRings: Ring[]): Vec {
  const a = deg2rad(surface.layout.angle);
  const pts = zoneRings.flat().map((p) => rotate(p, -a));
  const b = pts.length ? bboxOf(pts) : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const j = surface.tile.joint;
  return {
    x: alignCoord(surface.layout.alignX, b.minX, b.maxX, def.anchor.minX, def.anchor.maxX, j) + surface.layout.offsetX,
    y: alignCoord(surface.layout.alignY, b.minY, b.maxY, def.anchor.minY, def.anchor.maxY, j) + surface.layout.offsetY,
  };
}

interface Edge {
  a: Vec;
  b: Vec;
  box: BBox;
}

export interface ComputeOptions {
  /** ne calcule que les compteurs (optimiseur) */
  light?: boolean;
  offset?: Vec;
}

export function computeLayout(surface: Surface, opts: ComputeOptions = {}): LayoutResult {
  const def = buildPattern(surface.tile, surface.pattern);
  const zone = computeZone(surface);
  const zoneRings = zone.flat();
  const zoneArea = zone.reduce((s, p) => s + polyArea(p), 0);
  const zoneBox = zoneRings.length ? bboxOf(zoneRings.flat()) : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const angle = deg2rad(surface.layout.angle);
  const originLocal = patternOrigin(
    opts.offset ? { ...surface, layout: { ...surface.layout, offsetX: opts.offset.x, offsetY: opts.offset.y } } : surface,
    def,
    zoneRings
  );
  const origin = rotate(originLocal, angle);

  const empty: LayoutResult = {
    def,
    zone,
    zoneRings,
    zoneArea,
    zoneBox,
    tiles: [],
    full: 0,
    cut: 0,
    small: 0,
    total: 0,
    perFormat: def.formats.map((_, f) => ({ format: f, full: 0, cut: 0, total: 0 })),
    perColor: surface.colors.palette.map(() => 0),
    cutGroups: [],
    origin,
    angle,
    truncated: false,
  };
  if (!zoneRings.length || zoneArea <= 0) return empty;

  // région à couvrir, dans le repère du motif
  const localPts = zoneRings.flat().map((p) => rotate(p, -angle));
  const lb = bboxOf(localPts);
  const region = {
    minX: lb.minX - originLocal.x,
    maxX: lb.maxX - originLocal.x,
    minY: lb.minY - originLocal.y,
    maxY: lb.maxY - originLocal.y,
  };
  const generated = generateTiles(def, region);
  const truncated = generated.length > MAX_TILES;

  const edges: Edge[] = [];
  for (const ring of zoneRings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      edges.push({ a, b, box: bboxOf([a, b]) });
    }
  }
  const zonePC: PCMulti = zone.map((p) => p.map(toPairs));
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const toWorld = (p: Vec): Vec => {
    const x = p.x + originLocal.x;
    const y = p.y + originLocal.y;
    return { x: x * cosA - y * sinA, y: x * sinA + y * cosA };
  };

  const tiles: LaidTile[] = [];
  const minCut = surface.minCut;
  const motifCount = def.motif.length;
  for (const g of generated) {
    const m = def.motif[g.k];
    const poly = g.poly.map(toWorld);
    const tb = bboxOf(poly);
    if (!bboxOverlap(tb, zoneBox)) continue;

    let touching = false;
    for (const e of edges) {
      if (!bboxOverlap(e.box, tb, 1e-6)) continue;
      if (segmentHitsPoly(e.a, e.b, poly)) {
        touching = true;
        break;
      }
    }
    const key = `${g.i}:${g.j}:${g.k}`;
    const ox = g.poly[0].x - m.poly[0].x;
    const oy = g.poly[0].y - m.poly[0].y;
    const center = toWorld({ x: m.center.x + ox, y: m.center.y + oy });
    const tAngle = angle + m.angle;
    const base = {
      key,
      i: g.i,
      j: g.j,
      k: g.k,
      format: m.format,
      color: 0,
      poly,
      center,
      angle: tAngle,
    };

    if (!touching) {
      if (!pointInRings(centroid(poly), zoneRings)) continue;
      tiles.push({ ...base, status: "full", ratio: 1, cutW: m.fw, cutH: m.fh, rectCut: true, small: false });
      continue;
    }

    let inter: PCMulti;
    try {
      inter = polygonClipping.intersection([toPairs(poly)], zonePC);
    } catch {
      continue;
    }
    const pieces: Poly[] = inter.map((p) => p.map(fromPairs));
    const area = pieces.reduce((s, p) => s + polyArea(p), 0);
    const tileArea = ringArea(poly);
    const ratio = area / tileArea;
    if (area < 1 || ratio < 1e-4) continue;
    if (ratio > 0.9995) {
      tiles.push({ ...base, status: "full", ratio: 1, cutW: m.fw, cutH: m.fh, rectCut: true, small: false });
      continue;
    }
    // dimensions de la coupe dans le repère du carreau
    const local = pieces.flatMap((p) => p[0]).map((p) => rotate({ x: p.x - center.x, y: p.y - center.y }, -tAngle));
    const lbb = bboxOf(local);
    const cutW = lbb.maxX - lbb.minX;
    const cutH = lbb.maxY - lbb.minY;
    let rectCut = false;
    if (pieces.length === 1 && pieces[0].length === 1) {
      const ring = cleanRing(pieces[0][0].map((p) => rotate({ x: p.x - center.x, y: p.y - center.y }, -tAngle)), 0.05);
      if (ring.length === 4) {
        const tol = 0.5;
        rectCut = ring.every(
          (p) =>
            (Math.abs(p.x - lbb.minX) < tol || Math.abs(p.x - lbb.maxX) < tol) &&
            (Math.abs(p.y - lbb.minY) < tol || Math.abs(p.y - lbb.maxY) < tol)
        );
      }
    }
    const small = Math.min(cutW / m.fw, cutH / m.fh) < minCut - 1e-6;
    tiles.push({ ...base, status: "cut", pieces, ratio, cutW, cutH, rectCut, small });
  }

  // couleurs + statistiques
  let full = 0;
  let cut = 0;
  let small = 0;
  const perFormat = def.formats.map((_, f) => ({ format: f, full: 0, cut: 0, total: 0 }));
  const perColor = surface.colors.palette.map(() => 0);
  const groups = new Map<string, CutGroup>();
  for (const t of tiles) {
    t.color = tileColor(surface.colors, t.i, t.j, t.k, motifCount, t.key);
    const pf = perFormat[t.format];
    if (t.status === "full") {
      full++;
      pf.full++;
    } else {
      cut++;
      pf.cut++;
      if (t.small) small++;
      if (!opts.light) {
        const w = Math.round(t.cutW);
        const h = Math.round(t.cutH);
        const gk = `${t.format}|${w}|${h}|${t.rectCut}`;
        const g = groups.get(gk);
        if (g) g.count++;
        else groups.set(gk, { format: t.format, w, h, rect: t.rectCut, small: t.small, count: 1 });
      }
    }
    pf.total++;
    if (perColor[t.color] !== undefined) perColor[t.color]++;
  }
  const cutGroups = [...groups.values()].sort((a, b) => b.count - a.count || b.w * b.h - a.w * a.h);

  return {
    ...empty,
    tiles,
    full,
    cut,
    small,
    total: full + cut,
    perFormat,
    perColor,
    cutGroups,
    truncated,
  };
}

/** Réapplique les couleurs sans recalculer la géométrie (peinture, changement de palette). */
export function recolor(r: LayoutResult, colors: ColorSpec): LayoutResult {
  const motifCount = r.def.motif.length;
  const perColor = colors.palette.map(() => 0);
  const tiles = r.tiles.map((t) => {
    const c = tileColor(colors, t.i, t.j, t.k, motifCount, t.key);
    if (perColor[c] !== undefined) perColor[c]++;
    return c === t.color ? t : { ...t, color: c };
  });
  return { ...r, tiles, perColor };
}

const cache = new WeakMap<Surface, LayoutResult>();

/** Calepinage mis en cache par surface (les surfaces sont immuables). */
export function cachedLayout(s: Surface): LayoutResult {
  let r = cache.get(s);
  if (!r) {
    r = computeLayout(s);
    cache.set(s, r);
  }
  return r;
}

function segmentHitsPoly(a: Vec, b: Vec, poly: Vec[]): boolean {
  for (let i = 0; i < poly.length; i++) {
    if (segmentsIntersect(a, b, poly[i], poly[(i + 1) % poly.length])) return true;
  }
  return pointInRings(a, [poly]) || pointInRings(b, [poly]);
}

/** Score d'un calepinage : nombre de carreaux + pénalité pour les petites coupes. */
export function scoreLayout(r: LayoutResult, minCut: number): number {
  let score = r.total;
  for (const t of r.tiles) {
    if (t.status !== "cut" || !t.small) continue;
    const def = r.def.motif[t.k];
    const q = Math.min(t.cutW / def.fw, t.cutH / def.fh);
    score += 4 + 20 * Math.max(0, (minCut - q) / Math.max(minCut, 0.01));
  }
  return score;
}

/**
 * Recherche le décalage du motif minimisant les petites coupes puis le nombre de carreaux.
 * Asynchrone pour garder l'interface fluide.
 */
export async function optimizeOffset(
  surface: Surface,
  onProgress?: (p: number) => void,
  shouldStop?: () => boolean
): Promise<Vec> {
  const base = computeLayout(surface, { light: true });
  const { v1, v2 } = base.def;
  const heavy = base.tiles.length > 2500;
  const N = heavy ? 6 : 10;
  const refineSteps = heavy ? 2 : 3;
  const evalAt = (s: number, t: number) => {
    const off = { x: s * v1.x + t * v2.x, y: s * v1.y + t * v2.y };
    const r = computeLayout(surface, { light: true, offset: off });
    return { s, t, score: scoreLayout(r, surface.minCut) };
  };
  const totalEvals = N * N + refineSteps * 8;
  let done = 0;
  const tick = async () => {
    done++;
    if (done % 3 === 0) {
      onProgress?.(Math.min(1, done / totalEvals));
      await new Promise((r) => setTimeout(r, 0));
    }
  };
  let best = { s: 0, t: 0, score: Infinity };
  for (let a = 0; a < N; a++) {
    for (let b = 0; b < N; b++) {
      if (shouldStop?.()) return { x: surface.layout.offsetX, y: surface.layout.offsetY };
      const r = evalAt(a / N - 0.5, b / N - 0.5);
      if (r.score < best.score - 1e-9) best = r;
      await tick();
    }
  }
  let step = 1 / N / 2;
  for (let k = 0; k < refineSteps; k++) {
    const center = best;
    for (const [ds, dt] of [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ]) {
      if (shouldStop?.()) break;
      const r = evalAt(center.s + ds * step, center.t + dt * step);
      if (r.score < best.score - 1e-9) best = r;
      await tick();
    }
    step /= 2;
  }
  onProgress?.(1);
  const x = best.s * v1.x + best.t * v2.x;
  const y = best.s * v1.y + best.t * v2.y;
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

/** Coulis de joint (kg) : formule usuelle des fabricants, densité 1,6. */
export function groutKg(areaM2: number, w: number, h: number, joint: number, thickness: number) {
  if (w <= 0 || h <= 0 || joint <= 0 || thickness <= 0) return 0;
  return areaM2 * ((w + h) / (w * h)) * thickness * joint * 1.6;
}
