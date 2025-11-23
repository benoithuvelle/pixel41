import { useRef } from "react";
import {
  DEFAULT_FILL_COLOR,
  DEFAULT_STROKE_COLOR,
  PIXEL_SIZE,
  PIXEL_SIZE_CM,
  STROKE_WIDTH,
} from "./constants";

type Mode = "pixel" | "joint";

export default function Screen({
  grid,
  palette,
  activePaletteIndex,
  jointColor,
  setGrid,
  mode,
  walls,
  roomWidth,
  roomHeight,
  stairX,
  stairY,
  stairWidth,
  stairHeight,
  closetX,
  closetY,
  closetWidth,
  closetHeight,
  benchX,
  benchY,
  benchWidth,
  benchHeight,
  bench2X,
  bench2Y,
  bench2Width,
  bench2Height,
}: {
  grid: Grid;
  palette: string[];
  activePaletteIndex: number | null;
  jointColor: string;
  setGrid: (grid: Grid) => void;
  mode: Mode;
  walls: Wall[];
  roomWidth: number;
  roomHeight: number;
  stairX: number;
  stairY: number;
  stairWidth: number;
  stairHeight: number;
  closetX: number;
  closetY: number;
  closetWidth: number;
  closetHeight: number;
  benchX: number;
  benchY: number;
  benchWidth: number;
  benchHeight: number;
  bench2X: number;
  bench2Y: number;
  bench2Width: number;
  bench2Height: number;
}) {
  // Calculer le viewBox basé sur les dimensions de la pièce + 10% de marge
  const margin = 0.1; // 10% de marge
  const viewBoxWidth = roomWidth * (1 + 2 * margin);
  const viewBoxHeight = roomHeight * (1 + 2 * margin);
  const viewBoxX = -roomWidth * margin;
  const viewBoxY = -roomHeight * margin;

  const svgRef = useRef<SVGSVGElement>(null);

  const formatLength = (pixels: number): string => {
    const cm = (pixels / PIXEL_SIZE) * PIXEL_SIZE_CM;
    if (cm >= 100) {
      return `${(cm / 100).toFixed(2)}m`;
    }
    return `${Math.round(cm)}cm`;
  };

  const getWallLength = (wall: Wall): number => {
    const width = Math.abs(wall.x2 - wall.x1);
    const height = Math.abs(wall.y2 - wall.y1);
    // La longueur est la dimension principale (pas l'épaisseur)
    return Math.max(width, height);
  };

  const renderWall = (wall: Wall, key: string, showLabel: boolean = true) => {
    const width = Math.abs(wall.x2 - wall.x1);
    const height = Math.abs(wall.y2 - wall.y1);
    const x = Math.min(wall.x1, wall.x2);
    const y = Math.min(wall.y1, wall.y2);
    const length = getWallLength(wall);
    const isHorizontal = width > height;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const fontSize = Math.min(Math.max(length / 15, 4), 10);

    return (
      <g key={key}>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill="url(#wall-hatch)"
          stroke={DEFAULT_STROKE_COLOR}
          strokeWidth={STROKE_WIDTH * 20}
        />
        {showLabel && length > 5 && (
          <text
            x={centerX}
            y={centerY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fontSize}
            fill={DEFAULT_STROKE_COLOR}
            fontWeight="bold"
            style={{ pointerEvents: "none", userSelect: "none" }}
            transform={
              isHorizontal ? undefined : `rotate(-90 ${centerX} ${centerY})`
            }
          >
            {formatLength(length)}
          </text>
        )}
      </g>
    );
  };

  return (
    <svg
      ref={svgRef}
      className="border h-full w-full"
      viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
    >
      <defs>
        <pattern
          id="wall-hatch"
          patternUnits="userSpaceOnUse"
          width="4"
          height="4"
        >
          <rect width="4" height="4" fill="#e5e5e5" />
          <path
            d="M 0,4 l 4,-4 M -1,1 l 2,-2 M 3,5 l 2,-2"
            stroke={DEFAULT_STROKE_COLOR}
            strokeWidth="0.5"
          />
        </pattern>
        {/* Pattern pour l'escalier - une marche fait 18 cm */}
        {(() => {
          const STEP_WIDTH_CM = 18;
          const stepWidthPx = (STEP_WIDTH_CM / PIXEL_SIZE_CM) * PIXEL_SIZE;
          return (
            <pattern
              id="stair-pattern"
              patternUnits="userSpaceOnUse"
              width={stepWidthPx}
              height={stepWidthPx}
            >
              <rect width={stepWidthPx} height={stepWidthPx} fill="#d4d4d4" />
              <line
                x1="0"
                y1="0"
                x2="0"
                y2={stepWidthPx}
                stroke={DEFAULT_STROKE_COLOR}
                strokeWidth="0.3"
              />
            </pattern>
          );
        })()}
        {/* Masque pour n'afficher que les pixels à l'intérieur des murs */}
        <mask id="room-mask">
          {/* Fond noir = masqué (invisible) */}
          <rect
            x={viewBoxX}
            y={viewBoxY}
            width={viewBoxWidth}
            height={viewBoxHeight}
            fill="black"
          />
          {/* Zone blanche = visible (intérieur de la pièce) */}
          <rect
            x={0}
            y={0}
            width={roomWidth}
            height={roomHeight}
            fill="white"
          />
        </mask>
      </defs>
      <g mask="url(#room-mask)">
        {grid.pixels.map((row, rowIndex) =>
          row.map((pixel, columnIndex) => {
            const pixelColor =
              pixel.paletteIndex !== null && palette[pixel.paletteIndex]
                ? palette[pixel.paletteIndex]
                : DEFAULT_FILL_COLOR;
            return (
              <rect
                key={`${rowIndex}-${columnIndex}`}
                x={columnIndex * PIXEL_SIZE}
                y={rowIndex * PIXEL_SIZE}
                width={PIXEL_SIZE}
                height={PIXEL_SIZE}
                fill={pixelColor}
                stroke={jointColor}
                strokeWidth={STROKE_WIDTH * 20}
                onPointerEnter={(e) => {
                  if (
                    mode === "pixel" &&
                    e.buttons === 1 &&
                    activePaletteIndex !== null
                  ) {
                    const newGrid = { ...grid };
                    newGrid.pixels[rowIndex][columnIndex].paletteIndex =
                      activePaletteIndex;
                    setGrid(newGrid);
                  }
                }}
                onPointerDown={(e) => {
                  if (mode === "pixel" && activePaletteIndex !== null) {
                    e.stopPropagation();
                    const newGrid = { ...grid };
                    newGrid.pixels[rowIndex][columnIndex].paletteIndex =
                      activePaletteIndex;
                    setGrid(newGrid);
                  }
                }}
              />
            );
          })
        )}
      </g>
      {/* Escalier - dessiné avant les murs */}
      <rect
        x={stairX}
        y={stairY}
        width={stairWidth}
        height={stairHeight}
        fill="url(#stair-pattern)"
        stroke={DEFAULT_STROKE_COLOR}
        strokeWidth={STROKE_WIDTH * 20}
      />
      {/* Placard - rectangle avec diagonales */}
      <g>
        <rect
          x={closetX}
          y={closetY}
          width={closetWidth}
          height={closetHeight}
          fill="#f0f0f0"
          stroke={DEFAULT_STROKE_COLOR}
          strokeWidth={STROKE_WIDTH * 20}
        />
        {/* Diagonales internes */}
        <line
          x1={closetX}
          y1={closetY}
          x2={closetX + closetWidth}
          y2={closetY + closetHeight}
          stroke={DEFAULT_STROKE_COLOR}
          strokeWidth={STROKE_WIDTH * 15}
        />
        <line
          x1={closetX + closetWidth}
          y1={closetY}
          x2={closetX}
          y2={closetY + closetHeight}
          stroke={DEFAULT_STROKE_COLOR}
          strokeWidth={STROKE_WIDTH * 15}
        />
      </g>
      {/* Banquette - rectangle sans diagonales */}
      <g>
        <rect
          x={benchX}
          y={benchY}
          width={benchWidth}
          height={benchHeight}
          fill="#e8e8e8"
          stroke={DEFAULT_STROKE_COLOR}
          strokeWidth={STROKE_WIDTH * 20}
        />
        <text
          x={benchX + benchWidth / 2}
          y={benchY + benchHeight / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={Math.min(Math.max(benchWidth / 10, 8), 14)}
          fill={DEFAULT_STROKE_COLOR}
          fontWeight="bold"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          banquette
        </text>
      </g>
      {/* Deuxième banquette - contre le mur de droite */}
      <g>
        <rect
          x={bench2X}
          y={bench2Y}
          width={bench2Width}
          height={bench2Height}
          fill="#e8e8e8"
          stroke={DEFAULT_STROKE_COLOR}
          strokeWidth={STROKE_WIDTH * 20}
        />
        <text
          x={bench2X + bench2Width / 2}
          y={bench2Y + bench2Height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={Math.min(Math.max(bench2Height / 10, 8), 14)}
          fill={DEFAULT_STROKE_COLOR}
          fontWeight="bold"
          style={{ pointerEvents: "none", userSelect: "none" }}
          transform={`rotate(-90 ${bench2X + bench2Width / 2} ${
            bench2Y + bench2Height / 2
          })`}
        >
          banquette
        </text>
      </g>
      {walls.map((wall, index) => renderWall(wall, `wall-${index}`, true))}
    </svg>
  );
}
