declare global {
  interface Pixel {
    color: string;
  }

  interface Grid {
    width: number;
    height: number;
    pixels: Pixel[][];
  }
}

export {};
