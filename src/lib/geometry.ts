import type { Vec } from "@/types";

export type Ring = Vec[];

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const EMPTY_BBOX: BBox = {
  minX: Infinity,
  minY: Infinity,
  maxX: -Infinity,
  maxY: -Infinity,
};

export const v = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
export const cross = (a: Vec, b: Vec) => a.x * b.y - a.y * b.x;
export const len = (a: Vec) => Math.hypot(a.x, a.y);
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (a: Vec): Vec => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};

export const deg2rad = (d: number) => (d * Math.PI) / 180;

export function rotate(p: Vec, angleRad: number): Vec {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

export function bboxOf(points: Vec[], into?: BBox): BBox {
  const b = into ?? { ...EMPTY_BBOX };
  for (const p of points) {
    if (p.x < b.minX) b.minX = p.x;
    if (p.y < b.minY) b.minY = p.y;
    if (p.x > b.maxX) b.maxX = p.x;
    if (p.y > b.maxY) b.maxY = p.y;
  }
  return b;
}

export function bboxOverlap(a: BBox, b: BBox, eps = 0) {
  return (
    a.minX <= b.maxX + eps &&
    a.maxX >= b.minX - eps &&
    a.minY <= b.maxY + eps &&
    a.maxY >= b.minY - eps
  );
}

/** Aire signée (positive si anti-horaire). */
export function signedArea(ring: Ring): number {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export const ringArea = (ring: Ring) => Math.abs(signedArea(ring));

/** Test pair-impair sur un ensemble d'anneaux (contours + trous). */
export function pointInRings(p: Vec, rings: Ring[]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i];
      const b = ring[j];
      if (
        a.y > p.y !== b.y > p.y &&
        p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
      ) {
        inside = !inside;
      }
    }
  }
  return inside;
}

export function centroid(ring: Ring): Vec {
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % n];
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
    a += f;
  }
  if (Math.abs(a) < 1e-9) {
    const b = bboxOf(ring);
    return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

/** Intersection stricte ou par contact de deux segments. */
export function segmentsIntersect(a: Vec, b: Vec, c: Vec, d: Vec): boolean {
  const d1 = cross(sub(b, a), sub(c, a));
  const d2 = cross(sub(b, a), sub(d, a));
  const d3 = cross(sub(d, c), sub(a, c));
  const d4 = cross(sub(d, c), sub(b, c));
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  const onSeg = (p: Vec, q: Vec, r: Vec) =>
    Math.min(p.x, q.x) - 1e-9 <= r.x &&
    r.x <= Math.max(p.x, q.x) + 1e-9 &&
    Math.min(p.y, q.y) - 1e-9 <= r.y &&
    r.y <= Math.max(p.y, q.y) + 1e-9;
  if (Math.abs(d1) < 1e-9 && onSeg(a, b, c)) return true;
  if (Math.abs(d2) < 1e-9 && onSeg(a, b, d)) return true;
  if (Math.abs(d3) < 1e-9 && onSeg(c, d, a)) return true;
  if (Math.abs(d4) < 1e-9 && onSeg(c, d, b)) return true;
  return false;
}

/** Intersection de deux droites (p + t*r) et (q + u*s). */
export function lineIntersection(p: Vec, r: Vec, q: Vec, s: Vec): Vec | null {
  const rxs = cross(r, s);
  if (Math.abs(rxs) < 1e-12) return null;
  const t = cross(sub(q, p), s) / rxs;
  return add(p, scale(r, t));
}

/**
 * Décalage d'un polygone simple vers l'extérieur (joints en onglet, limités).
 */
export function offsetRing(ring: Ring, d: number): Ring {
  const n = ring.length;
  if (n < 3) return ring.slice();
  const ccw = signedArea(ring) > 0;
  const out: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const prev = ring[(i - 1 + n) % n];
    const cur = ring[i];
    const next = ring[(i + 1) % n];
    const e1 = norm(sub(cur, prev));
    const e2 = norm(sub(next, cur));
    // normale extérieure
    const n1 = ccw ? v(e1.y, -e1.x) : v(-e1.y, e1.x);
    const n2 = ccw ? v(e2.y, -e2.x) : v(-e2.y, e2.x);
    const p1 = add(prev, scale(n1, d));
    const p2 = add(cur, scale(n2, d));
    const ip = lineIntersection(p1, e1, p2, e2);
    if (!ip || dist(ip, cur) > Math.abs(d) * 4) {
      out.push(add(cur, scale(norm(add(n1, n2)), d)));
    } else {
      out.push(ip);
    }
  }
  return out;
}

/** Supprime les points en double et alignés. */
export function cleanRing(ring: Ring, eps = 0.01): Ring {
  let pts = ring.filter((p, i) => dist(p, ring[(i + 1) % ring.length]) > eps);
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i - 1 + pts.length) % pts.length];
      const b = pts[i];
      const c = pts[(i + 1) % pts.length];
      const ab = sub(b, a);
      const bc = sub(c, b);
      if (Math.abs(cross(norm(ab), norm(bc))) < 1e-6 && dot(ab, bc) > 0) {
        pts = pts.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  return pts;
}

export function isSelfIntersecting(ring: Ring): boolean {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      const c = ring[j];
      const d = ring[(j + 1) % n];
      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

export function ringToPath(ring: Ring): string {
  if (ring.length === 0) return "";
  let s = `M${r2(ring[0].x)} ${r2(ring[0].y)}`;
  for (let i = 1; i < ring.length; i++) s += `L${r2(ring[i].x)} ${r2(ring[i].y)}`;
  return s + "Z";
}

const r2 = (n: number) => Math.round(n * 100) / 100;
