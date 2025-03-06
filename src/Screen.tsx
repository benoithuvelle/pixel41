import { DEFAULT_STROKE_COLOR, PIXEL_SIZE, STROKE_WIDTH } from "./constants";

export default function Screen({
  grid,
  fillColor,
  setGrid,
}: {
  grid: Grid;
  fillColor: string;
  setGrid: (grid: Grid) => void;
}) {
  return (
    <svg className="border h-full w-full" viewBox="0 0 400 400">
      {grid.pixels.map((row, rowIndex) =>
        row.map((pixel, columnIndex) => (
          <rect
            key={`${rowIndex}-${columnIndex}`}
            x={columnIndex * PIXEL_SIZE}
            y={rowIndex * PIXEL_SIZE}
            width={PIXEL_SIZE}
            height={PIXEL_SIZE}
            fill={pixel.color}
            stroke={DEFAULT_STROKE_COLOR}
            strokeWidth={STROKE_WIDTH}
            onPointerEnter={(e) => {
              if (e.buttons === 1) {
                const newGrid = { ...grid };
                newGrid.pixels[rowIndex][columnIndex].color = fillColor;
                setGrid(newGrid);
              }
            }}
            onPointerDown={() => {
              console.log(fillColor);
              const newGrid = { ...grid };
              newGrid.pixels[rowIndex][columnIndex].color = fillColor;
              setGrid(newGrid);
            }}
          />
        ))
      )}
    </svg>
  );
}
