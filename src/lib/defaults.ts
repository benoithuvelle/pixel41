import type { Opening, OpeningKind, Project, Surface, SurfaceKind, TileSpec, Vec } from "@/types";
import { uid } from "./format";

export interface TilePreset {
  label: string;
  w: number;
  h: number;
  joint: number;
  thickness: number;
}

export const TILE_PRESETS: TilePreset[] = [
  { label: "10×10", w: 100, h: 100, joint: 2, thickness: 7 },
  { label: "15×15", w: 150, h: 150, joint: 2, thickness: 8 },
  { label: "20×20", w: 200, h: 200, joint: 2, thickness: 9 },
  { label: "30×30", w: 300, h: 300, joint: 3, thickness: 9 },
  { label: "45×45", w: 450, h: 450, joint: 3, thickness: 9 },
  { label: "60×60", w: 600, h: 600, joint: 3, thickness: 10 },
  { label: "80×80", w: 800, h: 800, joint: 3, thickness: 10 },
  { label: "120×120", w: 1200, h: 1200, joint: 2, thickness: 10 },
  { label: "30×60", w: 600, h: 300, joint: 3, thickness: 9 },
  { label: "60×120", w: 1200, h: 600, joint: 3, thickness: 10 },
  { label: "20×120", w: 1200, h: 200, joint: 2, thickness: 9 },
  { label: "15×90", w: 900, h: 150, joint: 2, thickness: 9 },
  { label: "Métro 7,5×15", w: 150, h: 75, joint: 2, thickness: 7 },
  { label: "Métro 10×20", w: 200, h: 100, joint: 2, thickness: 7 },
  { label: "Zellige 10×10", w: 100, h: 100, joint: 1.5, thickness: 10 },
  { label: "Pixel 11,55", w: 115.5, h: 115.5, joint: 2.5, thickness: 6 },
];

export const OPENING_PRESETS: Record<SurfaceKind, { kind: OpeningKind; label: string; w: number; h: number; y: number }[]> = {
  floor: [
    { kind: "obstacle", label: "Obstacle", w: 600, h: 600, y: 0 },
    { kind: "obstacle", label: "Baignoire", w: 1700, h: 700, y: 0 },
    { kind: "obstacle", label: "Receveur", w: 900, h: 900, y: 0 },
    { kind: "obstacle", label: "Meuble", w: 800, h: 500, y: 0 },
  ],
  wall: [
    { kind: "door", label: "Porte", w: 830, h: 2040, y: 0 },
    { kind: "window", label: "Fenêtre", w: 1000, h: 1150, y: 950 },
    { kind: "obstacle", label: "Meuble", w: 800, h: 850, y: 0 },
    { kind: "obstacle", label: "Niche", w: 600, h: 300, y: 1100 },
  ],
};

export function defaultTile(): TileSpec {
  return {
    name: "Carrelage",
    w: 600,
    h: 600,
    joint: 3,
    thickness: 10,
    perBox: 4,
    pricePerM2: 0,
    jointColor: "#c8c8c4",
  };
}

export function rect(w: number, h: number): Vec[] {
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
}

/** Pièce en L : grand rectangle W×H privé d'un coin haut-droit cw×ch. */
export function lShape(w: number, h: number, cw: number, ch: number): Vec[] {
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h - ch },
    { x: w - cw, y: h - ch },
    { x: w - cw, y: h },
    { x: 0, y: h },
  ];
}

/** Mur sous rampant : hauteur basse à droite, pente démarrant à slopeX. */
export function slopedWall(w: number, hHigh: number, hLow: number, slopeX: number): Vec[] {
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: hLow },
    { x: slopeX, y: hHigh },
    { x: 0, y: hHigh },
  ];
}

export function gableWall(w: number, hSide: number, hTop: number): Vec[] {
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: hSide },
    { x: w / 2, y: hTop },
    { x: 0, y: hSide },
  ];
}

export function newSurface(kind: SurfaceKind, name?: string, outline?: Vec[]): Surface {
  const floor = kind === "floor";
  return {
    id: uid(),
    name: name ?? (floor ? "Sol" : "Mur"),
    kind,
    outline: outline ?? (floor ? rect(3600, 2800) : rect(3000, 2500)),
    openings: [],
    band: null,
    tile: floor
      ? defaultTile()
      : { ...defaultTile(), w: 200, h: 100, joint: 2, thickness: 7, perBox: 50, jointColor: "#c8c8c4" },
    pattern: {
      type: floor ? "grid" : "offset",
      offsetRatio: 0.5,
      offsetDir: "rows",
      chevronAngle: 45,
      smallSize: 150,
    },
    colors: {
      mode: "single",
      palette: [floor ? "#d9c9ab" : "#f7f7f5", "#8e8e8b"],
      weights: [1, 1],
      seed: 1,
      paint: {},
    },
    layout: {
      angle: 0,
      alignX: "center",
      alignY: floor ? "center" : "start",
      offsetX: 0,
      offsetY: 0,
    },
    margin: 10,
    minCut: 1 / 3,
  };
}

export function newOpening(kind: OpeningKind, label: string, x: number, y: number, w: number, h: number): Opening {
  return { id: uid(), kind, label, x, y, w, h };
}

export function demoProject(): Project {
  const floor = newSurface("floor", "Sol séjour", lShape(4800, 3900, 1500, 1200));
  floor.openings.push(newOpening("obstacle", "Îlot", 1200, 1100, 1800, 900));
  floor.tile = { ...floor.tile, name: "Grès cérame 60×60" };
  const wall = newSurface("wall", "Mur cuisine");
  wall.outline = rect(3200, 2500);
  wall.openings.push(newOpening("door", "Porte", 2200, 0, 830, 2040));
  wall.openings.push(newOpening("window", "Fenêtre", 500, 1050, 1000, 1150));
  wall.tile = { ...wall.tile, name: "Faïence métro 10×20" };
  wall.band = { from: 0, to: 1500 };
  return {
    version: 1,
    name: "Mon projet",
    surfaces: [floor, wall],
    activeId: floor.id,
  };
}

export function emptyProject(): Project {
  const floor = newSurface("floor", "Sol");
  return { version: 1, name: "Nouveau projet", surfaces: [floor], activeId: floor.id };
}

/** Normalise un projet importé (robustesse aux anciennes versions / fichiers incomplets). */
export function sanitizeProject(raw: unknown): Project | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<Project>;
  if (!Array.isArray(p.surfaces) || p.surfaces.length === 0) return null;
  const surfaces: Surface[] = p.surfaces.map((s) => {
    const base = newSurface(s.kind === "wall" ? "wall" : "floor");
    return {
      ...base,
      ...s,
      id: s.id || uid(),
      outline: Array.isArray(s.outline) && s.outline.length >= 3 ? s.outline : base.outline,
      openings: Array.isArray(s.openings) ? s.openings : [],
      tile: { ...base.tile, ...(s.tile ?? {}) },
      pattern: { ...base.pattern, ...(s.pattern ?? {}) },
      colors: { ...base.colors, ...(s.colors ?? {}), paint: { ...(s.colors?.paint ?? {}) } },
      layout: { ...base.layout, ...(s.layout ?? {}) },
      margin: typeof s.margin === "number" ? s.margin : base.margin,
      minCut: typeof s.minCut === "number" ? s.minCut : base.minCut,
      band: s.band ?? null,
    };
  });
  const activeId = surfaces.some((s) => s.id === p.activeId) ? (p.activeId as string) : surfaces[0].id;
  return { version: 1, name: p.name || "Projet", surfaces, activeId };
}
