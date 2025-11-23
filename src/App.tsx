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
  WALL_THICKNESS,
  PIXEL_SIZE,
  PIXEL_SIZE_CM,
} from "./constants.ts";
import "./App.css";
import colors from "./colors.ts";
import Screen from "./Screen.tsx";

const GRID_HEIGHT = 40;
const GRID_WIDTH = 40;

type Mode = "pixel" | "joint";

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

  // Murs hardcodés : pièce de 3m15 (315 cm) par 3m71 (371 cm)
  const cmToPixels = (cm: number): number => {
    return (cm / PIXEL_SIZE_CM) * PIXEL_SIZE;
  };

  const ROOM_WIDTH_CM = 315; // 3m15
  const ROOM_HEIGHT_CM = 371; // 3m71
  const ROOM_WIDTH_PX = cmToPixels(ROOM_WIDTH_CM);
  const ROOM_HEIGHT_PX = cmToPixels(ROOM_HEIGHT_CM);

  // Escalier : profondeur 55 cm, longueur 100 cm, en bas à droite
  const STAIR_DEPTH_CM = 55; // Profondeur depuis le mur de droite
  const STAIR_LENGTH_CM = 100; // Longueur sur l'axe y depuis le bas
  const STAIR_X_CM = ROOM_WIDTH_CM - STAIR_DEPTH_CM; // Position x (260 cm)
  const STAIR_Y_CM = ROOM_HEIGHT_CM - STAIR_LENGTH_CM; // Position y depuis le haut (271 cm)

  // Placard : au fond du couloir, vertical le long du mur de gauche
  // En haut à gauche, contre le mur de gauche
  const CLOSET_DEPTH_CM = 40; // Profondeur de 40 cm (largeur du placard)
  const CLOSET_LENGTH_CM = 84; // Longueur de 60 cm le long du mur de gauche
  const CLOSET_X_CM = WALL_THICKNESS / 2; // Commence après la moitié de l'épaisseur du mur gauche
  const CLOSET_Y_CM = WALL_THICKNESS / 2; // Commence après la moitié de l'épaisseur du mur haut (en haut)

  // Banquette : contre le deuxième mur intérieur (125 cm), vers l'escalier
  const BENCH_LENGTH_CM = 125; // Longueur de 125 cm le long du mur
  const BENCH_DEPTH_CM = 50; // Profondeur de 50 cm vers l'escalier
  const BENCH_X_CM = 60 + 130; // Commence après le premier mur (60 cm) + 130 cm de vide = 190 cm
  const BENCH_Y_CM = 98; // Au niveau du mur intérieur horizontal (98 cm du haut)

  // Deuxième banquette : contre le mur de droite, entre la banquette existante et l'escalier
  const BENCH2_DEPTH_CM = 50; // Profondeur de 50 cm (comme la première banquette)
  const BENCH2_START_Y_CM = BENCH_Y_CM + BENCH_DEPTH_CM; // Commence après la fin de la première banquette
  const BENCH2_END_Y_CM = STAIR_Y_CM; // Se termine au début de l'escalier
  const BENCH2_LENGTH_CM = BENCH2_END_Y_CM - BENCH2_START_Y_CM; // Longueur calculée
  const BENCH2_X_CM = ROOM_WIDTH_CM - BENCH2_DEPTH_CM; // Commence à 50 cm du mur de droite
  const BENCH2_Y_CM = BENCH2_START_Y_CM; // Position y

  // Créer les 4 murs de la pièce
  const walls: Wall[] = [
    // Mur bas (horizontal)
    {
      x1: 0,
      y1: -WALL_THICKNESS / 2,
      x2: ROOM_WIDTH_PX,
      y2: WALL_THICKNESS / 2,
      thickness: WALL_THICKNESS,
    },
    // Mur droite (vertical)
    {
      x1: ROOM_WIDTH_PX - WALL_THICKNESS / 2,
      y1: 0,
      x2: ROOM_WIDTH_PX + WALL_THICKNESS / 2,
      y2: ROOM_HEIGHT_PX,
      thickness: WALL_THICKNESS,
    },
    // Mur haut (horizontal)
    {
      x1: 0,
      y1: ROOM_HEIGHT_PX - WALL_THICKNESS / 2,
      x2: ROOM_WIDTH_PX,
      y2: ROOM_HEIGHT_PX + WALL_THICKNESS / 2,
      thickness: WALL_THICKNESS,
    },
    // Mur gauche (vertical)
    {
      x1: -WALL_THICKNESS / 2,
      y1: 0,
      x2: WALL_THICKNESS / 2,
      y2: ROOM_HEIGHT_PX,
      thickness: WALL_THICKNESS,
    },
    // Mur intérieur horizontal : 60 cm, part du mur gauche à 98 cm du haut
    {
      x1: WALL_THICKNESS / 2,
      y1: cmToPixels(98) - WALL_THICKNESS / 2,
      x2: cmToPixels(60) + WALL_THICKNESS / 2,
      y2: cmToPixels(98) + WALL_THICKNESS / 2,
      thickness: WALL_THICKNESS,
    },
    // Mur intérieur horizontal : part après 130 cm de vide après le premier mur, jusqu'au mur de droite
    {
      x1: cmToPixels(60 + 130) - WALL_THICKNESS / 2,
      y1: cmToPixels(98) - WALL_THICKNESS / 2,
      x2: ROOM_WIDTH_PX - WALL_THICKNESS / 2,
      y2: cmToPixels(98) + WALL_THICKNESS / 2,
      thickness: WALL_THICKNESS,
    },
  ];

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
        roomWidth={ROOM_WIDTH_PX}
        roomHeight={ROOM_HEIGHT_PX}
        stairX={cmToPixels(STAIR_X_CM)}
        stairY={cmToPixels(STAIR_Y_CM)}
        stairWidth={cmToPixels(STAIR_DEPTH_CM)}
        stairHeight={cmToPixels(STAIR_LENGTH_CM)}
        closetX={cmToPixels(CLOSET_X_CM)}
        closetY={cmToPixels(CLOSET_Y_CM)}
        closetWidth={cmToPixels(CLOSET_DEPTH_CM)}
        closetHeight={cmToPixels(CLOSET_LENGTH_CM)}
        benchX={cmToPixels(BENCH_X_CM) + WALL_THICKNESS / 2}
        benchY={cmToPixels(BENCH_Y_CM) + WALL_THICKNESS / 2}
        benchWidth={cmToPixels(BENCH_LENGTH_CM)}
        benchHeight={cmToPixels(BENCH_DEPTH_CM)}
        bench2X={cmToPixels(BENCH2_X_CM) - WALL_THICKNESS / 2}
        bench2Y={cmToPixels(BENCH2_Y_CM) + WALL_THICKNESS / 2}
        bench2Width={cmToPixels(BENCH2_DEPTH_CM)}
        bench2Height={cmToPixels(BENCH2_LENGTH_CM)}
      />
      <div className="w-100 flex flex-col items-center gap-y-2 overflow-y-auto h-full">
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
