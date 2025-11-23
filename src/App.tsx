import { useState, useEffect } from "react";
import { Badge } from "./components/ui/badge.tsx";
import { Button } from "./components/ui/button.tsx";
import { Label } from "./components/ui/label.tsx";
import {
  ACTIVE_PALETTE_INDEX_KEY,
  // DEFAULT_FILL_COLOR,
  DEFAULT_STROKE_COLOR,
  GRID_SIZE,
  JOINT_COLOR_STORAGE_KEY,
  MAX_PALETTE_COLORS,
  PALETTE_STORAGE_KEY,
  WALL_STORAGE_KEY,
} from "./constants.ts";
import "./App.css";
import colors from "./colors.ts";
import Screen from "./Screen.tsx";

const GRID_HEIGHT = 40;
const GRID_WIDTH = 40;

type Mode = "pixel" | "wall" | "joint";

function App() {
  const gridBase = Array.from({ length: GRID_HEIGHT }, () =>
    Array.from({ length: GRID_WIDTH }, () => ({
      paletteIndex: null,
    }))
  );

  // Palette de couleurs (jusqu'à 8 couleurs)
  const [palette, setPalette] = useState<string[]>(() => {
    const saved = localStorage.getItem(PALETTE_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [activePaletteIndex, setActivePaletteIndex] = useState<number | null>(
    () => {
      const saved = localStorage.getItem(ACTIVE_PALETTE_INDEX_KEY);
      return saved !== null ? parseInt(saved, 10) : null;
    }
  );
  const [paletteAction, setPaletteAction] = useState<"none" | "add" | "update">(
    "none"
  );
  const [updatePaletteIndex, setUpdatePaletteIndex] = useState<number | null>(
    null
  );

  const [jointColor, setJointColor] = useState<string>(() => {
    const saved = localStorage.getItem(JOINT_COLOR_STORAGE_KEY);
    return saved || DEFAULT_STROKE_COLOR;
  });
  const [mode, setMode] = useState<Mode>("pixel");

  const [grid, setGrid] = useState<Grid>({
    width: GRID_SIZE,
    height: GRID_SIZE,
    pixels: gridBase,
  });

  // Charger les murs depuis le localStorage au démarrage
  const [walls, setWalls] = useState<Wall[]>(() => {
    const saved = localStorage.getItem(WALL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  // Sauvegarder les murs dans le localStorage à chaque changement
  useEffect(() => {
    localStorage.setItem(WALL_STORAGE_KEY, JSON.stringify(walls));
  }, [walls]);

  // Sauvegarder la couleur des joints dans le localStorage à chaque changement
  useEffect(() => {
    localStorage.setItem(JOINT_COLOR_STORAGE_KEY, jointColor);
  }, [jointColor]);

  // Sauvegarder la palette dans le localStorage à chaque changement
  useEffect(() => {
    localStorage.setItem(PALETTE_STORAGE_KEY, JSON.stringify(palette));
  }, [palette]);

  // Sauvegarder l'index actif de la palette
  useEffect(() => {
    if (activePaletteIndex !== null) {
      localStorage.setItem(
        ACTIVE_PALETTE_INDEX_KEY,
        activePaletteIndex.toString()
      );
    } else {
      localStorage.removeItem(ACTIVE_PALETTE_INDEX_KEY);
    }
  }, [activePaletteIndex]);

  function reset() {
    setGrid({
      width: GRID_SIZE,
      height: GRID_SIZE,
      pixels: gridBase,
    });
  }

  function resetWalls() {
    if (walls.length === 0) return;
    if (
      window.confirm(
        "Êtes-vous sûr de vouloir effacer tous les murs ? Cette action est irréversible."
      )
    ) {
      setWalls([]);
      localStorage.removeItem(WALL_STORAGE_KEY);
    }
  }

  function resetPalette() {
    if (palette.length === 0) return;
    if (
      window.confirm(
        "Êtes-vous sûr de vouloir réinitialiser la palette ? Cette action est irréversible."
      )
    ) {
      setPalette([]);
      setActivePaletteIndex(null);
      setPaletteAction("none");
      localStorage.removeItem(PALETTE_STORAGE_KEY);
      localStorage.removeItem(ACTIVE_PALETTE_INDEX_KEY);
    }
  }

  function addToPalette(color: string) {
    if (palette.length < MAX_PALETTE_COLORS) {
      setPalette([...palette, color]);
      setActivePaletteIndex(palette.length);
      setPaletteAction("none");
    }
  }

  function updatePaletteColor(index: number, color: string) {
    const newPalette = [...palette];
    newPalette[index] = color;
    setPalette(newPalette);
    setPaletteAction("none");
    setUpdatePaletteIndex(null);
  }

  function removeFromPalette(index: number) {
    const newPalette = palette.filter((_, i) => i !== index);
    setPalette(newPalette);
    // Mettre à jour les pixels qui utilisaient cette couleur
    const newGrid = { ...grid };
    for (const row of newGrid.pixels) {
      for (const pixel of row) {
        if (pixel.paletteIndex === index) {
          pixel.paletteIndex = null;
        } else if (pixel.paletteIndex !== null && pixel.paletteIndex > index) {
          pixel.paletteIndex = pixel.paletteIndex - 1;
        }
      }
    }
    setGrid(newGrid);
    if (activePaletteIndex === index) {
      setActivePaletteIndex(null);
    } else if (activePaletteIndex !== null && activePaletteIndex > index) {
      setActivePaletteIndex(activePaletteIndex - 1);
    }
  }

  function handleColorClick(colorHex: string) {
    if (mode === "joint") {
      setJointColor(colorHex);
    } else if (mode === "pixel") {
      if (paletteAction === "add") {
        addToPalette(colorHex);
      } else if (paletteAction === "update" && updatePaletteIndex !== null) {
        updatePaletteColor(updatePaletteIndex, colorHex);
      }
    }
  }

  return (
    <div className="flex flex-row h-full gap-2">
      <Screen
        grid={grid}
        setGrid={setGrid}
        palette={palette}
        activePaletteIndex={activePaletteIndex}
        jointColor={jointColor}
        mode={mode}
        walls={walls}
        setWalls={setWalls}
      />
      <div className="w-100 flex flex-col items-center gap-y-2">
        <div className="flex flex-row justify-between w-full">
          <div className="flex flex-col gap-2">
            {mode === "pixel" &&
              activePaletteIndex !== null &&
              palette[activePaletteIndex] && (
                <div
                  className="w-20 h-20 rounded-full border-white border-6 shadow"
                  style={{ backgroundColor: palette[activePaletteIndex] }}
                />
              )}
            {mode === "joint" && (
              <div
                className="w-20 h-20 rounded-full border-white border-6 shadow"
                style={{ backgroundColor: jointColor }}
              />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={reset}>
              Reset Grille
            </Button>
            <Button variant="outline" onClick={resetWalls}>
              Reset Murs
            </Button>
            {mode === "pixel" && (
              <Button variant="outline" onClick={resetPalette}>
                Reset Palette
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-row gap-2 mb-2">
          <Button
            variant="outline"
            onClick={() => setMode("pixel")}
            className={mode === "pixel" ? "bg-accent" : ""}
          >
            Pixel
          </Button>
          <Button
            variant="outline"
            onClick={() => setMode("wall")}
            className={mode === "wall" ? "bg-accent" : ""}
          >
            Mur
          </Button>
          <Button
            variant="outline"
            onClick={() => setMode("joint")}
            className={mode === "joint" ? "bg-accent" : ""}
          >
            Joint
          </Button>
        </div>

        {mode === "pixel" && (
          <div className="mb-4 w-full">
            <Badge className="mb-2">
              Palette ({palette.length}/{MAX_PALETTE_COLORS})
            </Badge>
            {palette.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center mb-2">
                {palette.map((color, index) => (
                  <div
                    key={index}
                    className="flex flex-col items-center relative"
                  >
                    <div
                      className={`w-12 h-12 rounded-full border-4 shadow border-white hover:scale-110 duration-75 cursor-pointer ${
                        activePaletteIndex === index
                          ? "ring-4 ring-blue-500"
                          : ""
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => {
                        if (paletteAction === "update") {
                          setUpdatePaletteIndex(index);
                        } else {
                          setActivePaletteIndex(index);
                          setPaletteAction("none");
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        removeFromPalette(index);
                      }}
                      title={`Couleur ${index + 1}${
                        paletteAction === "update"
                          ? " (clic pour mettre à jour)"
                          : " (clic droit pour supprimer)"
                      }`}
                    />
                    <Label className="text-xs mt-1">{index + 1}</Label>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-row gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (paletteAction === "add") {
                    setPaletteAction("none");
                  } else {
                    setPaletteAction("add");
                    setUpdatePaletteIndex(null);
                  }
                }}
                disabled={palette.length >= MAX_PALETTE_COLORS}
                className={paletteAction === "add" ? "bg-accent" : ""}
              >
                {paletteAction === "add" ? "Annuler" : "Ajouter"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (paletteAction === "update") {
                    setPaletteAction("none");
                    setUpdatePaletteIndex(null);
                  } else {
                    setPaletteAction("update");
                  }
                }}
                disabled={palette.length === 0}
                className={paletteAction === "update" ? "bg-accent" : ""}
              >
                {paletteAction === "update" ? "Annuler" : "Modifier"}
              </Button>
            </div>
            {activePaletteIndex !== null && (
              <p className="text-xs text-center mt-2">
                Couleur active: {activePaletteIndex + 1}
              </p>
            )}
            {palette.length === 0 && (
              <p className="text-xs text-center mt-2 text-gray-500">
                Aucune couleur dans la palette. Cliquez sur "Ajouter" puis
                sélectionnez une couleur.
              </p>
            )}
          </div>
        )}

        <Badge>
          {mode === "joint"
            ? "Pick joint color"
            : mode === "pixel" && paletteAction === "add"
            ? "Sélectionnez une couleur pour l'ajouter à la palette"
            : mode === "pixel" && paletteAction === "update"
            ? "Sélectionnez une couleur pour mettre à jour"
            : "Pick a color"}
        </Badge>
        <div className="grid grid-cols-5">
          {Object.values(colors).map((color) => (
            <div key={color.code} className="flex flex-col items-center m-4">
              <div
                className="w-10 h-10 rounded-full border-4 shadow border-white hover:scale-110 duration-75 cursor-pointer"
                style={{ backgroundColor: color.hexa }}
                onClick={() => handleColorClick(color.hexa)}
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
