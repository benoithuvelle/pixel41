import type { Surface, Vec } from "@/types";
import { bboxOf, dist, dot, isSelfIntersecting, norm, signedArea, sub } from "./geometry";

const round = (n: number) => Math.round(n * 10) / 10;
const rp = (p: Vec): Vec => ({ x: round(p.x), y: round(p.y) });

/**
 * Change la longueur du côté i : son extrémité et le côté suivant sont translatés
 * dans l'axe du côté (comportement « étirer » qui conserve les angles droits).
 */
export function setEdgeLength(s: Surface, i: number, newLen: number): Surface {
  const pts = s.outline;
  const n = pts.length;
  const a = pts[i];
  const b = pts[(i + 1) % n];
  const L = dist(a, b);
  if (L < 1e-6 || newLen <= 0) return s;
  const u = norm(sub(b, a));
  const delta = newLen - L;
  const ib = (i + 1) % n;
  const ic = (i + 2) % n;
  const moveIdx = n > 3 ? [ib, ic] : [ib];
  let next = pts.map((p, k) => (moveIdx.includes(k) ? rp({ x: p.x + u.x * delta, y: p.y + u.y * delta }) : p));
  if (isSelfIntersecting(next) || Math.abs(signedArea(next)) < 1) {
    // repli : on ne déplace que l'extrémité
    next = pts.map((p, k) => (k === ib ? rp({ x: p.x + u.x * delta, y: p.y + u.y * delta }) : p));
  }
  return { ...s, outline: next };
}

export function insertPoint(s: Surface, edge: number): Surface {
  const n = s.outline.length;
  const a = s.outline[edge];
  const b = s.outline[(edge + 1) % n];
  const m = rp({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const outline = [...s.outline.slice(0, edge + 1), m, ...s.outline.slice(edge + 1)];
  return { ...s, outline };
}

export function removePoint(s: Surface, idx: number): Surface {
  if (s.outline.length <= 3) return s;
  return { ...s, outline: s.outline.filter((_, k) => k !== idx) };
}

/** Ramène le contour pour que son coin bas-gauche soit en (0,0), en déplaçant aussi les ouvertures. */
export function normalizeOrigin(s: Surface): Surface {
  const b = bboxOf(s.outline);
  if (Math.abs(b.minX) < 1e-6 && Math.abs(b.minY) < 1e-6) return s;
  return {
    ...s,
    outline: s.outline.map((p) => rp({ x: p.x - b.minX, y: p.y - b.minY })),
    openings: s.openings.map((o) => ({ ...o, x: round(o.x - b.minX), y: round(o.y - b.minY) })),
  };
}

export function isAxisRect(pts: Vec[]): boolean {
  if (pts.length !== 4) return false;
  const b = bboxOf(pts);
  return pts.every(
    (p) => (Math.abs(p.x - b.minX) < 0.01 || Math.abs(p.x - b.maxX) < 0.01) && (Math.abs(p.y - b.minY) < 0.01 || Math.abs(p.y - b.maxY) < 0.01)
  );
}

/** Redimensionne un rectangle aligné en gardant le coin bas-gauche. */
export function resizeRect(s: Surface, w: number, h: number): Surface {
  const b = bboxOf(s.outline);
  const outline = s.outline.map((p) => ({
    x: Math.abs(p.x - b.maxX) < 0.01 ? round(b.minX + w) : p.x,
    y: Math.abs(p.y - b.maxY) < 0.01 ? round(b.minY + h) : p.y,
  }));
  return { ...s, outline };
}

export function edgeAngleDeg(a: Vec, b: Vec): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

export function directionArrow(a: Vec, b: Vec): string {
  const ang = edgeAngleDeg(a, b);
  const arrows = ["→", "↗", "↑", "↖", "←", "↙", "↓", "↘"];
  const idx = ((Math.round(ang / 45) % 8) + 8) % 8;
  return arrows[idx];
}

/** Angle intérieur au sommet i (degrés). */
export function interiorAngle(pts: Vec[], i: number): number {
  const n = pts.length;
  const prev = pts[(i - 1 + n) % n];
  const cur = pts[i];
  const next = pts[(i + 1) % n];
  const a = norm(sub(prev, cur));
  const b = norm(sub(next, cur));
  let ang = (Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * 180) / Math.PI;
  const ccw = signedArea(pts) > 0;
  const crossZ = (cur.x - prev.x) * (next.y - cur.y) - (cur.y - prev.y) * (next.x - cur.x);
  const convex = ccw ? crossZ > 0 : crossZ < 0;
  if (!convex) ang = 360 - ang;
  return ang;
}
