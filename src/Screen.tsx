import { useState, useRef } from "react";
import {
  DEFAULT_FILL_COLOR,
  DEFAULT_STROKE_COLOR,
  PIXEL_SIZE,
  PIXEL_SIZE_CM,
  STROKE_WIDTH,
  WALL_THICKNESS,
} from "./constants";

type Mode = "pixel" | "wall" | "joint";

export default function Screen({
  grid,
  palette,
  activePaletteIndex,
  jointColor,
  setGrid,
  mode,
  walls,
  setWalls,
}: {
  grid: Grid;
  palette: string[];
  activePaletteIndex: number | null;
  jointColor: string;
  setGrid: (grid: Grid) => void;
  mode: Mode;
  walls: Wall[];
  setWalls: (walls: Wall[]) => void;
}) {
  const gridWidth = grid.pixels[0]?.length || 0;
  const gridHeight = grid.pixels.length || 0;
  const viewBoxWidth = gridWidth * PIXEL_SIZE;
  const viewBoxHeight = gridHeight * PIXEL_SIZE;

  const [isDrawingWall, setIsDrawingWall] = useState(false);
  const [wallStart, setWallStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [wallPreview, setWallPreview] = useState<Wall | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const getSVGCoordinates = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const svg = svgRef.current;
    const point = svg.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const svgPoint = point.matrixTransform(ctm.inverse());
    return {
      x: svgPoint.x,
      y: svgPoint.y,
    };
  };

  const createOrthogonalWall = (
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): Wall => {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);

    // Forcer l'orthogonalité : choisir la direction la plus proche
    if (dx > dy) {
      // Mur horizontal
      return {
        x1: Math.min(x1, x2),
        y1: y1 - WALL_THICKNESS / 2,
        x2: Math.max(x1, x2),
        y2: y1 + WALL_THICKNESS / 2,
        thickness: WALL_THICKNESS,
      };
    } else {
      // Mur vertical
      return {
        x1: x1 - WALL_THICKNESS / 2,
        y1: Math.min(y1, y2),
        x2: x1 + WALL_THICKNESS / 2,
        y2: Math.max(y1, y2),
        thickness: WALL_THICKNESS,
      };
    }
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (mode === "wall") {
      e.preventDefault();
      const coords = getSVGCoordinates(e);
      setIsDrawingWall(true);
      setWallStart(coords);
      setWallPreview(null);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (mode === "wall" && isDrawingWall && wallStart) {
      const coords = getSVGCoordinates(e);
      const wall = createOrthogonalWall(
        wallStart.x,
        wallStart.y,
        coords.x,
        coords.y
      );
      setWallPreview(wall);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (mode === "wall" && isDrawingWall && wallStart) {
      const coords = getSVGCoordinates(e);
      const wall = createOrthogonalWall(
        wallStart.x,
        wallStart.y,
        coords.x,
        coords.y
      );
      // Vérifier que le mur a une longueur minimale
      const width = Math.abs(wall.x2 - wall.x1);
      const height = Math.abs(wall.y2 - wall.y1);
      if (width > 1 || height > 1) {
        setWalls([...walls, wall]);
      }
      setIsDrawingWall(false);
      setWallStart(null);
      setWallPreview(null);
    }
  };

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
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
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
      </defs>
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
      {walls.map((wall, index) => renderWall(wall, `wall-${index}`, true))}
      {wallPreview && renderWall(wallPreview, "preview", true)}
    </svg>
  );
}
