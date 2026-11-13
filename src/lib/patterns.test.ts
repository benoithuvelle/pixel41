import { describe, expect, it } from "vitest";
import type { PatternSpec, PatternType, TileSpec, Surface } from "@/types";
import { buildPattern, generateTiles } from "./patterns";
import { pointInRings, type Ring } from "./geometry";
import { computeLayout, optimizeOffset } from "./layout";

const tile = (w: number, h: number, joint = 3): TileSpec => ({
  name: "t",
  w,
  h,
  joint,
  thickness: 9,
  perBox: 0,
  pricePerM2: 0,
  jointColor: "#999",
});

const spec = (type: PatternType, extra: Partial<PatternSpec> = {}): PatternSpec => ({
  type,
  offsetRatio: 0.5,
  offsetDir: "rows",
  chevronAngle: 45,
  smallSize: 150,
  ...extra,
});

function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distToPoly(px: number, py: number, poly: Ring) {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    d = Math.min(d, distToSeg(px, py, a.x, a.y, b.x, b.y));
  }
  return d;
}

const cases: [string, TileSpec, PatternSpec][] = [
  ["grid", tile(300, 300), spec("grid")],
  ["offset 1/2", tile(600, 300), spec("offset")],
  ["offset 1/3 cols", tile(600, 300), spec("offset", { offsetRatio: 1 / 3, offsetDir: "cols" })],
  ["herringbone", tile(600, 150), spec("herringbone")],
  ["basket", tile(300, 100, 0), spec("basket")],
  ["basket joint", tile(303, 150), spec("basket")],
  ["chevron 45", tile(600, 100), spec("chevron")],
  ["chevron 60", tile(500, 120), spec("chevron", { chevronAngle: 60 })],
  ["hexagon", tile(200, 200), spec("hexagon")],
  ["pinwheel", tile(300, 300), spec("pinwheel", { smallSize: 147 })],
  ["opus", tile(197, 197), spec("opus")],
];

describe("motifs de pose", () => {
  for (const [name, t, s] of cases) {
    it(`${name} : ni chevauchement ni trou`, () => {
      const def = buildPattern(t, s);
      const tiles = generateTiles(def, { minX: -2500, minY: -2500, maxX: 2500, maxY: 2500 });
      expect(tiles.length).toBeGreaterThan(10);
      let seed = 12345;
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      for (let n = 0; n < 1500; n++) {
        const x = -1200 + rnd() * 2400;
        const y = -1200 + rnd() * 2400;
        let inside = 0;
        let minD = Infinity;
        for (const g of tiles) {
          if (pointInRings({ x, y }, [g.poly])) inside++;
          else minD = Math.min(minD, distToPoly(x, y, g.poly));
        }
        expect(inside).toBeLessThanOrEqual(1);
        if (inside === 0) expect(minD).toBeLessThanOrEqual(t.joint + 1e-6);
      }
      // densité : surface des carreaux / surface de la cellule cohérente avec les joints
      const cell = Math.abs(def.v1.x * def.v2.y - def.v1.y * def.v2.x);
      const tilesArea = def.motif.reduce((sum, m) => {
        let a = 0;
        for (let i = 0; i < m.poly.length; i++) {
          const p = m.poly[i];
          const q = m.poly[(i + 1) % m.poly.length];
          a += p.x * q.y - q.x * p.y;
        }
        return sum + Math.abs(a) / 2;
      }, 0);
      expect(tilesArea).toBeLessThanOrEqual(cell + 1e-6);
      if (t.joint === 0 && name === "basket") expect(tilesArea).toBeCloseTo(cell, 3);
    });
  }
});

const baseSurface = (): Surface => ({
  id: "s",
  name: "Sol",
  kind: "floor",
  outline: [
    { x: 0, y: 0 },
    { x: 3150, y: 0 },
    { x: 3150, y: 3710 },
    { x: 0, y: 3710 },
  ],
  openings: [],
  band: null,
  tile: tile(300, 300),
  pattern: spec("grid"),
  colors: { mode: "single", palette: ["#cccccc"], weights: [1], seed: 1, paint: {} },
  layout: { angle: 0, alignX: "start", alignY: "start", offsetX: 0, offsetY: 0 },
  margin: 10,
  minCut: 1 / 3,
});

describe("calepinage", () => {
  it("compte les carreaux d'une pièce rectangulaire", () => {
    const r = computeLayout(baseSurface());
    expect(r.zoneArea / 1e6).toBeCloseTo(11.6865, 4);
    expect(r.full).toBe(120);
    expect(r.cut).toBe(23);
    expect(r.total).toBe(143);
    // colonne de droite : 3150 - 10*303 = 120 mm de large
    expect(r.cutGroups.some((g) => g.w === 120 && g.h === 300 && g.rect)).toBe(true);
  });

  it("centre le calepinage symétriquement", () => {
    const s = baseSurface();
    s.layout.alignX = "center";
    s.layout.alignY = "center";
    const r = computeLayout(s);
    const cuts = r.tiles.filter((t) => t.status === "cut");
    const left = cuts.filter((t) => t.center.x < 500).map((t) => Math.round(t.cutW));
    const right = cuts.filter((t) => t.center.x > 2650).map((t) => Math.round(t.cutW));
    expect(Math.min(...left)).toBe(Math.min(...right));
  });

  it("exclut les ouvertures et la bande d'une élévation", () => {
    const s = baseSurface();
    s.kind = "wall";
    s.outline = [
      { x: 0, y: 0 },
      { x: 2000, y: 0 },
      { x: 2000, y: 2500 },
      { x: 0, y: 2500 },
    ];
    s.band = { from: 0, to: 1200 };
    s.openings = [{ id: "d", kind: "door", label: "Porte", x: 200, y: 0, w: 800, h: 2040 }];
    const r = computeLayout(s);
    expect(r.zoneArea).toBeCloseTo(2000 * 1200 - 800 * 1200, 3);
    expect(r.tiles.every((t) => t.status === "full" || (t.pieces && t.pieces.length > 0))).toBe(true);
  });

  it("diagonale à 45° : coupes biaises", () => {
    const s = baseSurface();
    s.layout.angle = 45;
    const r = computeLayout(s);
    expect(r.cut).toBeGreaterThan(20);
    expect(r.cutGroups.some((g) => !g.rect)).toBe(true);
  });

  it("l'optimiseur réduit les petites coupes", async () => {
    const s = baseSurface();
    s.layout.offsetX = 250;
    s.layout.offsetY = 260;
    const before = computeLayout(s);
    const off = await optimizeOffset(s);
    s.layout.offsetX = off.x;
    s.layout.offsetY = off.y;
    const after = computeLayout(s);
    expect(after.small).toBeLessThanOrEqual(before.small);
    expect(after.small).toBe(0);
  });
});
