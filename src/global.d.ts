declare global {
  interface Pixel {
    paletteIndex: number | null; // Index dans la palette, null = pas de couleur
  }

  interface Grid {
    width: number;
    height: number;
    pixels: Pixel[][];
  }

  interface Wall {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    thickness: number;
  }
}

export {};
