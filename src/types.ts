// Modèle de données. Toutes les longueurs sont en millimètres.
// Repère : x vers la droite, y vers le haut (en élévation, y = hauteur depuis le sol).

export interface Vec {
  x: number;
  y: number;
}

export type SurfaceKind = "floor" | "wall";

export type OpeningKind = "door" | "window" | "obstacle";

/** Zone non carrelée (porte, fenêtre, meuble, baignoire...). x,y = coin bas-gauche. */
export interface Opening {
  id: string;
  kind: OpeningKind;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type PatternType =
  | "grid"
  | "offset"
  | "herringbone"
  | "basket"
  | "chevron"
  | "hexagon"
  | "pinwheel"
  | "opus";

export interface TileSpec {
  name: string;
  /** largeur du carreau (sens x du motif) */
  w: number;
  /** hauteur du carreau (sens y du motif) */
  h: number;
  joint: number;
  thickness: number;
  /** carreaux par carton (0 = inconnu) */
  perBox: number;
  /** prix au m² (0 = non renseigné) */
  pricePerM2: number;
  jointColor: string;
}

export interface PatternSpec {
  type: PatternType;
  /** décalage d'une rangée sur l'autre (fraction de carreau) */
  offsetRatio: number;
  /** "rows" : rangées horizontales décalées ; "cols" : colonnes décalées */
  offsetDir: "rows" | "cols";
  /** angle des chevrons (degrés) */
  chevronAngle: number;
  /** côté du petit carreau (moulinet) */
  smallSize: number;
}

export type ColorMode = "single" | "checker" | "rows" | "cols" | "random";

export interface ColorSpec {
  mode: ColorMode;
  palette: string[];
  weights: number[];
  seed: number;
  /** couleurs peintes à la main : clé de carreau -> index palette */
  paint: Record<string, number>;
}

export type Align = "start" | "center" | "joint" | "end";

export interface LayoutSpec {
  angle: number;
  alignX: Align;
  alignY: Align;
  offsetX: number;
  offsetY: number;
}

export interface Band {
  from: number;
  to: number;
}

export interface Surface {
  id: string;
  name: string;
  kind: SurfaceKind;
  outline: Vec[];
  openings: Opening[];
  /** élévation : hauteur carrelée (null = toute la surface) */
  band: Band | null;
  tile: TileSpec;
  pattern: PatternSpec;
  colors: ColorSpec;
  layout: LayoutSpec;
  /** marge de chutes en % */
  margin: number;
  /** seuil de petite coupe (fraction du carreau) */
  minCut: number;
}

export interface Project {
  version: 1;
  name: string;
  surfaces: Surface[];
  activeId: string;
}
