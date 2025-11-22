import { useState } from "react";
import { Badge } from "./components/ui/badge.tsx";
import { Label } from "./components/ui/label.tsx";
import { DEFAULT_FILL_COLOR, GRID_SIZE } from "./constants.ts";
import "./App.css";
import colors from "./colors.ts";
import Screen from "./Screen.tsx";

function App() {
  const gridBase = Array.from({ length: 40 }, () =>
    Array.from({ length: 40 }, () => ({
      size: 10,
      color: DEFAULT_FILL_COLOR,
    }))
  );

  const [fillColor, setFillColor] = useState<string>(DEFAULT_FILL_COLOR);

  const [grid, setGrid] = useState<Grid>({
    width: GRID_SIZE,
    height: GRID_SIZE,
    pixels: gridBase,
  });

  function reset() {
    setGrid({
      width: GRID_SIZE,
      height: GRID_SIZE,
      pixels: gridBase,
    });
  }

  return (
    <div className="flex flex-row h-full gap-2">
      <Screen grid={grid} setGrid={setGrid} fillColor={fillColor} />
      <div className="w-100 flex flex-col items-center gap-y-2">
        <div className="flex flex-row justify-between w-full">
          <div
            className="w-20 h-20 rounded-full border-white border-6 shadow"
            style={{ backgroundColor: fillColor }}
          />
          <button onClick={reset}>Reset</button>
        </div>

        <Badge>Pick a color</Badge>
        <div className="grid grid-cols-5">
          {Object.values(colors).map((color) => (
            <div key={color.code} className="flex flex-col items-center m-4">
              <div
                className="w-10 h-10 rounded-full border-4 shadow border-white hover:scale-110 duration-75 cursor-pointer"
                style={{ backgroundColor: color.hexa }}
                onClick={() => setFillColor(color.hexa)}
              />
              <Label className="text-xs mt-2 text-center">
                {color.name} {color.code}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
