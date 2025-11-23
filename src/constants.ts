import colors from "./colors";

export const PIXEL_SIZE = 11.55;
export const PIXEL_SIZE_CM = 11.8; // Taille d'un pixel en cm (11.55 + 2.5mm de joint)
export const GRID_SIZE = 10;
export const DEFAULT_FILL_COLOR = colors.WHITE.hexa;
export const DEFAULT_STROKE_COLOR = colors.BLACK.hexa;
export const STROKE_WIDTH = 0.03;
// Épaisseur des murs : 15 cm convertis en pixels
export const WALL_THICKNESS_CM = 15;
export const WALL_THICKNESS = (WALL_THICKNESS_CM / PIXEL_SIZE_CM) * PIXEL_SIZE;
export const WALL_STORAGE_KEY = "pixel41_walls";
export const JOINT_COLOR_STORAGE_KEY = "pixel41_joint_color";
export const PALETTE_STORAGE_KEY = "pixel41_palette";
export const ACTIVE_PALETTE_INDEX_KEY = "pixel41_active_palette_index";
export const MAX_PALETTE_COLORS = 8;
