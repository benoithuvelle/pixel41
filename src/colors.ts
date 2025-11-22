interface Color {
  name: string;
  hexa: string;
  code: number;
}

const colors: { [key: string]: Color } = {
  RED: { name: "RED", hexa: "#c43a34", code: 1 },
  LOBSTER: { name: "LOBSTER", hexa: "#c75732", code: 2 },
  CORAL: { name: "CORAL", hexa: "#c17858", code: 3 },
  BORDEAUX: { name: "BORDEAUX", hexa: "#6d2a36", code: 4 },
  PURPLE: { name: "PURPLE", hexa: "#361040", code: 5 },
  VIOLET: { name: "VIOLET", hexa: "#543145", code: 6 },
  ROSE: { name: "ROSE", hexa: "#f7e0d0", code: 7 },
  STRAWBERRY: { name: "STRAWBERRY", hexa: "#ce978a", code: 8 },
  BLUSH: { name: "BLUSH", hexa: "#dba589", code: 9 },
  NUDE: { name: "NUDE", hexa: "#ddb08f", code: 10 },
  POWDER: { name: "POWDER", hexa: "#e9d1b8", code: 11 },
  TERRA: { name: "TERRA", hexa: "#cba782", code: 12 },
  TOBACCO: { name: "TOBACCO", hexa: "#966240", code: 13 },
  CURRY: { name: "CURRY", hexa: "#c9aa6a", code: 14 },
  KHAKI: { name: "KHAKI", hexa: "#90833c", code: 15 },
  LEMON: { name: "LEMON", hexa: "#feef8d", code: 16 },
  VANILLA: { name: "VANILLA", hexa: "#f3e8bc", code: 17 },
  SAND: { name: "SAND", hexa: "#ddccab", code: 18 },
  NUT: { name: "NUT", hexa: "#dbc7ab", code: 19 },
  ALMOND: { name: "ALMOND", hexa: "#f2ebe0", code: 20 },
  WHITE: { name: "WHITE", hexa: "#FFFFFF", code: 21 },
  PEARL: { name: "PEARL", hexa: "#dedad3", code: 22 },
  GREY: { name: "GREY", hexa: "#b9b09c", code: 23 },
  MUD: { name: "MUD", hexa: "#b1a893", code: 24 },
  BLACK: { name: "BLACK", hexa: "#050400", code: 25 },
  ANTRAX: { name: "ANTRAX", hexa: "#3e3d40", code: 26 },
  NOTTE: { name: "NOTTE", hexa: "#465057", code: 27 },
  OCEAN: { name: "OCEAN", hexa: "#003769", code: 28 },
  TUAREG: { name: "TUAREG", hexa: "#79a5d1", code: 29 },
  POOL: { name: "POOL", hexa: "#7fa8c5", code: 30 },
  CERULEAN: { name: "CERULEAN", hexa: "#8294a4", code: 31 },
  CLOUD: { name: "CLOUD", hexa: "#90a2a6", code: 32 },
  SKY: { name: "SKY", hexa: "#a7b2ab", code: 33 },
  CELADON: { name: "CELADON", hexa: "#9fab9f", code: 34 },
  MUSK: { name: "MUSK", hexa: "#8b9485", code: 35 },
  SALVIA: { name: "SALVIA", hexa: "#d2d4c5", code: 36 },
  MILITARY: { name: "MILITARY", hexa: "#5b6555", code: 37 },
  FROG: { name: "FROG", hexa: "#819e79", code: 38 },
  PEACOCK: { name: "PEACOCK", hexa: "#0b4a48", code: 39 },
  MARINE: { name: "MARINE", hexa: "#7fbdb2", code: 40 },
  MINT: { name: "MINT", hexa: "#b4d2bc", code: 41 },
};

export default colors;
