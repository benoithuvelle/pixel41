import { useState, useEffect } from "react";
import { Badge } from "./components/ui/badge.tsx";
import { Button } from "./components/ui/button.tsx";
import { Label } from "./components/ui/label.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog.tsx";
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

function App() {
  const gridBase = Array.from({ length: GRID_HEIGHT }, () =>
    Array.from({ length: GRID_WIDTH }, () => ({
      paletteIndex: null,
    }))
  );

  // État pour gérer la popup de nouveau projet
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(() => {
    const saved = localStorage.getItem(PALETTE_STORAGE_KEY);
    return !saved || JSON.parse(saved).length === 0;
  });
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState<boolean>(
    () => {
      const saved = localStorage.getItem(PALETTE_STORAGE_KEY);
      return !saved || JSON.parse(saved).length === 0;
    }
  );
  const [tempPalette, setTempPalette] = useState<string[]>([]);
  const [tempPaletteAction, setTempPaletteAction] = useState<
    "none" | "add" | "update"
  >("add");
  const [tempUpdatePaletteIndex, setTempUpdatePaletteIndex] = useState<
    number | null
  >(null);

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

  const [jointColor, setJointColor] = useState<string>(() => {
    const saved = localStorage.getItem(JOINT_COLOR_STORAGE_KEY);
    return saved || DEFAULT_STROKE_COLOR;
  });
  const [isJointColorDialogOpen, setIsJointColorDialogOpen] =
    useState<boolean>(false);

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

  function handleNewProject() {
    // Réinitialiser la grille
    setGrid({
      width: GRID_SIZE,
      height: GRID_SIZE,
      pixels: gridBase,
    });
    // Réinitialiser la palette
    setPalette([]);
    setActivePaletteIndex(null);
    setTempPalette([]);
    setTempPaletteAction("add");
    setTempUpdatePaletteIndex(null);
    setIsInitialLoad(false); // Ce n'est plus le chargement initial
    // Ouvrir la popup
    setIsNewProjectDialogOpen(true);
  }

  function handleOpenPaletteDialog() {
    // Pré-remplir la palette temporaire avec la palette actuelle
    setTempPalette([...palette]);
    setTempPaletteAction("add");
    setTempUpdatePaletteIndex(null);
    setIsInitialLoad(false);
    setIsNewProjectDialogOpen(true);
  }

  function handleTempColorClick(colorHex: string) {
    if (tempPaletteAction === "add") {
      if (tempPalette.length < MAX_PALETTE_COLORS) {
        setTempPalette([...tempPalette, colorHex]);
        setTempPaletteAction("add");
      }
    } else if (
      tempPaletteAction === "update" &&
      tempUpdatePaletteIndex !== null
    ) {
      const newTempPalette = [...tempPalette];
      newTempPalette[tempUpdatePaletteIndex] = colorHex;
      setTempPalette(newTempPalette);
      setTempPaletteAction("add");
      setTempUpdatePaletteIndex(null);
    }
  }

  function handleRemoveFromTempPalette(index: number) {
    setTempPalette(tempPalette.filter((_, i) => i !== index));
  }

  function handleValidatePalette() {
    if (tempPalette.length === 0) {
      alert("Veuillez ajouter au moins une couleur à la palette.");
      return;
    }
    setPalette(tempPalette);
    setActivePaletteIndex(0);
    setIsInitialLoad(false);
    setIsNewProjectDialogOpen(false);
  }

  function handleDialogOpenChange(open: boolean) {
    // Empêcher la fermeture si c'est le chargement initial et que la palette est vide
    if (!open && isInitialLoad && tempPalette.length === 0) {
      return;
    }
    setIsNewProjectDialogOpen(open);
  }

  function handleJointColorClick(colorHex: string) {
    setJointColor(colorHex);
    setIsJointColorDialogOpen(false);
  }

  return (
    <>
      <Dialog
        open={isNewProjectDialogOpen}
        onOpenChange={handleDialogOpenChange}
      >
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          showCloseButton={!isInitialLoad}
        >
          <DialogHeader>
            <DialogTitle>
              Nouveau projet - Configuration de la palette
            </DialogTitle>
            <DialogDescription>
              Configurez votre palette de couleurs (jusqu'à {MAX_PALETTE_COLORS}{" "}
              couleurs). Cliquez sur une couleur ci-dessous pour l'ajouter à
              votre palette.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Badge>
                Palette temporaire ({tempPalette.length}/{MAX_PALETTE_COLORS})
              </Badge>
              {tempPalette.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {tempPalette.map((color, index) => (
                    <div
                      key={index}
                      className="flex flex-col items-center relative"
                    >
                      <div
                        className="w-12 h-12 rounded-full border-4 shadow border-white hover:scale-110 duration-75 cursor-pointer"
                        style={{ backgroundColor: color }}
                        onClick={() => {
                          if (tempPaletteAction === "update") {
                            setTempUpdatePaletteIndex(index);
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          handleRemoveFromTempPalette(index);
                        }}
                        title={`Couleur ${index + 1}${
                          tempPaletteAction === "update"
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
                    if (tempPaletteAction === "add") {
                      setTempPaletteAction("none");
                    } else {
                      setTempPaletteAction("add");
                      setTempUpdatePaletteIndex(null);
                    }
                  }}
                  disabled={tempPalette.length >= MAX_PALETTE_COLORS}
                  className={tempPaletteAction === "add" ? "bg-accent" : ""}
                >
                  {tempPaletteAction === "add" ? "Annuler" : "Ajouter"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (tempPaletteAction === "update") {
                      setTempPaletteAction("add");
                      setTempUpdatePaletteIndex(null);
                    } else {
                      setTempPaletteAction("update");
                    }
                  }}
                  disabled={tempPalette.length === 0}
                  className={tempPaletteAction === "update" ? "bg-accent" : ""}
                >
                  {tempPaletteAction === "update" ? "Annuler" : "Modifier"}
                </Button>
              </div>
              {tempPalette.length === 0 && (
                <p className="text-xs text-center mt-2 text-gray-500">
                  Aucune couleur dans la palette. Cliquez sur "Ajouter" puis
                  sélectionnez une couleur.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Badge>
                {tempPaletteAction === "add"
                  ? "Sélectionnez une couleur pour l'ajouter à la palette"
                  : tempPaletteAction === "update"
                  ? "Sélectionnez une couleur pour mettre à jour"
                  : "Sélectionnez une action ci-dessus"}
              </Badge>
              <div className="grid grid-cols-5 max-h-96 overflow-y-auto">
                {Object.values(colors).map((color) => (
                  <div
                    key={color.code}
                    className="flex flex-col items-center m-2"
                  >
                    <div
                      className="w-10 h-10 rounded-full border-4 shadow border-white hover:scale-110 duration-75 cursor-pointer"
                      style={{ backgroundColor: color.hexa }}
                      onClick={() => handleTempColorClick(color.hexa)}
                    />
                    <Label className="text-xs mt-2 text-center">
                      {color.name} {color.code}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            {!isInitialLoad && (
              <Button
                variant="outline"
                onClick={() => setIsNewProjectDialogOpen(false)}
              >
                Annuler
              </Button>
            )}
            <Button
              onClick={handleValidatePalette}
              disabled={tempPalette.length === 0}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={isJointColorDialogOpen}
        onOpenChange={setIsJointColorDialogOpen}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sélectionner la couleur du joint</DialogTitle>
            <DialogDescription>
              Cliquez sur une couleur pour la sélectionner
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-5 gap-4 max-h-96 overflow-y-auto">
            {Object.values(colors).map((color) => (
              <div key={color.code} className="flex flex-col items-center">
                <div
                  className="w-10 h-10 rounded-full border-4 shadow border-white hover:scale-110 duration-75 cursor-pointer"
                  style={{ backgroundColor: color.hexa }}
                  onClick={() => handleJointColorClick(color.hexa)}
                />
                <Label className="text-xs mt-2 text-center">
                  {color.name} {color.code}
                </Label>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <div className="flex flex-row h-full gap-2">
        <Screen
          grid={grid}
          setGrid={setGrid}
          palette={palette}
          activePaletteIndex={activePaletteIndex}
          jointColor={jointColor}
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
        <div className="w-100 flex flex-col gap-4 overflow-y-auto h-full">
          {/* Card Nouveau projet */}
          <Card>
            <CardHeader>
              <CardTitle>Nouveau projet</CardTitle>
              <CardDescription>
                Réinitialise la grille et la palette
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="default"
                onClick={handleNewProject}
                className="w-full"
              >
                Nouveau projet
              </Button>
            </CardContent>
          </Card>

          {/* Card Palette */}
          <Card>
            <CardHeader>
              <CardTitle>Palette</CardTitle>
              <CardDescription>
                Configurez votre palette de couleurs (jusqu'à{" "}
                {MAX_PALETTE_COLORS} couleurs)
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Button
                variant="outline"
                onClick={handleOpenPaletteDialog}
                className="w-full"
              >
                {palette.length > 0
                  ? "Actualiser la palette"
                  : "Définir la palette"}
              </Button>
              {palette.length > 0 && (
                <div className="flex flex-col gap-2">
                  <Badge className="w-fit">
                    {palette.length}/{MAX_PALETTE_COLORS} couleurs
                  </Badge>
                  <div className="flex flex-wrap gap-2 justify-center">
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
                            setActivePaletteIndex(index);
                          }}
                          title={`Couleur ${index + 1}${
                            activePaletteIndex === index ? " (active)" : ""
                          }`}
                        />
                        <Label className="text-xs mt-1">{index + 1}</Label>
                      </div>
                    ))}
                  </div>
                  {activePaletteIndex !== null && (
                    <p className="text-xs text-center text-muted-foreground">
                      Couleur active: {activePaletteIndex + 1}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card Joint */}
          <Card>
            <CardHeader>
              <CardTitle>Joint</CardTitle>
              <CardDescription>
                Cliquez sur la couleur pour la modifier
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-center">
                <div
                  className="w-20 h-20 rounded-full border-white border-6 shadow cursor-pointer hover:scale-110 transition-transform"
                  style={{ backgroundColor: jointColor }}
                  onClick={() => setIsJointColorDialogOpen(true)}
                  title="Cliquez pour changer la couleur du joint"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

export default App;
