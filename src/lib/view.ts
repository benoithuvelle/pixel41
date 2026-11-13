import type { Surface, Vec } from "@/types";
import { bboxOf, type BBox } from "./geometry";

export interface View {
  s: number;
  tx: number;
  ty: number;
}

export const toScreen = (view: View, p: Vec): Vec => ({ x: p.x * view.s + view.tx, y: -p.y * view.s + view.ty });
export const toWorld = (view: View, p: Vec): Vec => ({ x: (p.x - view.tx) / view.s, y: -(p.y - view.ty) / view.s });

/** Épaisseur des murs dessinés autour d'un sol (mm). */
export const WALL_T = 160;

export interface Selection {
  edge?: number | null;
  opening?: string | null;
}

export interface DrawingOptions {
  showCuts: boolean;
  showCutLabels: boolean;
  showDims: boolean;
}

/** Emprise du dessin (avec murs) pour cadrer la vue. */
export function drawingBounds(surface: Surface): BBox {
  const b = bboxOf(surface.outline);
  const m = surface.kind === "floor" ? WALL_T : 0;
  return { minX: b.minX - m, minY: b.minY - m - (surface.kind === "wall" ? 100 : 0), maxX: b.maxX + m, maxY: b.maxY + m };
}

export interface Pad {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function fitView(surface: Surface, width: number, height: number, pad: number | Pad = 56): View {
  const p = typeof pad === "number" ? { top: pad, right: pad, bottom: pad, left: pad } : pad;
  const b = drawingBounds(surface);
  const w = Math.max(1, b.maxX - b.minX);
  const h = Math.max(1, b.maxY - b.minY);
  const aw = Math.max(40, width - p.left - p.right);
  const ah = Math.max(40, height - p.top - p.bottom);
  const s = Math.max(1e-4, Math.min(aw / w, ah / h));
  return {
    s,
    tx: p.left + aw / 2 - ((b.minX + b.maxX) / 2) * s,
    ty: p.top + ah / 2 + ((b.minY + b.maxY) / 2) * s,
  };
}
