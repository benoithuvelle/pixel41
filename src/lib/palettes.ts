export interface NamedColor {
  name: string;
  hex: string;
}

export interface PaletteLibrary {
  name: string;
  colors: NamedColor[];
}

const pixel: [string, string][] = [
  ["Red", "#c43a34"],
  ["Lobster", "#c75732"],
  ["Coral", "#c17858"],
  ["Bordeaux", "#6d2a36"],
  ["Purple", "#361040"],
  ["Violet", "#543145"],
  ["Rose", "#f7e0d0"],
  ["Strawberry", "#ce978a"],
  ["Blush", "#dba589"],
  ["Nude", "#ddb08f"],
  ["Powder", "#e9d1b8"],
  ["Terra", "#cba782"],
  ["Tobacco", "#966240"],
  ["Curry", "#c9aa6a"],
  ["Khaki", "#90833c"],
  ["Lemon", "#feef8d"],
  ["Vanilla", "#f3e8bc"],
  ["Sand", "#ddccab"],
  ["Nut", "#dbc7ab"],
  ["Almond", "#f2ebe0"],
  ["White", "#ffffff"],
  ["Pearl", "#dedad3"],
  ["Grey", "#b9b09c"],
  ["Mud", "#b1a893"],
  ["Black", "#050400"],
  ["Antrax", "#3e3d40"],
  ["Notte", "#465057"],
  ["Ocean", "#003769"],
  ["Tuareg", "#79a5d1"],
  ["Pool", "#7fa8c5"],
  ["Cerulean", "#8294a4"],
  ["Cloud", "#90a2a6"],
  ["Sky", "#a7b2ab"],
  ["Celadon", "#9fab9f"],
  ["Musk", "#8b9485"],
  ["Salvia", "#d2d4c5"],
  ["Military", "#5b6555"],
  ["Frog", "#819e79"],
  ["Peacock", "#0b4a48"],
  ["Marine", "#7fbdb2"],
  ["Mint", "#b4d2bc"],
];

export const LIBRARIES: PaletteLibrary[] = [
  {
    name: "Classiques",
    colors: [
      { name: "Blanc", hex: "#f7f7f5" },
      { name: "Crème", hex: "#efe6d6" },
      { name: "Sable", hex: "#d9c9ab" },
      { name: "Grège", hex: "#b8ad9c" },
      { name: "Gris clair", hex: "#c9c9c7" },
      { name: "Gris", hex: "#8e8e8b" },
      { name: "Anthracite", hex: "#3d3e40" },
      { name: "Noir", hex: "#141414" },
      { name: "Terracotta", hex: "#b5603d" },
      { name: "Brique", hex: "#8e3b2a" },
      { name: "Chêne", hex: "#b88b5a" },
      { name: "Noyer", hex: "#6e4b33" },
      { name: "Vert sauge", hex: "#9aab95" },
      { name: "Vert bouteille", hex: "#24493c" },
      { name: "Bleu pétrole", hex: "#1f4e5a" },
      { name: "Bleu ciel", hex: "#9cc3d8" },
      { name: "Rose poudré", hex: "#e2bcb0" },
      { name: "Moutarde", hex: "#c99a2e" },
    ],
  },
  {
    name: "Nuancier Pixel 41zero42",
    colors: pixel.map(([name, hex]) => ({ name, hex })),
  },
];

export const JOINT_COLORS: NamedColor[] = [
  { name: "Blanc", hex: "#f2f2f0" },
  { name: "Gris perle", hex: "#c8c8c4" },
  { name: "Gris ciment", hex: "#9a9a96" },
  { name: "Beige", hex: "#d8ccb6" },
  { name: "Anthracite", hex: "#4a4b4d" },
  { name: "Noir", hex: "#1c1c1c" },
];

export function colorName(hex: string): string {
  const h = hex.toLowerCase();
  for (const lib of LIBRARIES) {
    const c = lib.colors.find((c) => c.hex.toLowerCase() === h);
    if (c) return c.name;
  }
  return hex.toUpperCase();
}

/** Couleur de texte lisible sur un fond donné. */
export function contrastText(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#000";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111" : "#fff";
}
