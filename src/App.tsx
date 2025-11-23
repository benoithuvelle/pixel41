import { useState, useEffect, useRef } from "react";
import { Download } from "lucide-react";
import jsPDF from "jspdf";
import { Input } from "./components/ui/input.tsx";
import { Pencil, Trash2 } from "lucide-react";
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
  const [tempUpdatePaletteIndex, setTempUpdatePaletteIndex] = useState<
    number | null
  >(null);

  // Images d'inspiration pour le configurateur de palette
  const inspirationImages = [
    "/41Zero42_Pixel_16_008.jpg",
    "/41Zero42_Pixel_31_03.jpg",
    "/41Zero42_Pixel_39_11.jpg",
  ];
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);

  // Changer l'image toutes les 5 secondes
  useEffect(() => {
    if (!isNewProjectDialogOpen) return;

    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % inspirationImages.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isNewProjectDialogOpen, inspirationImages.length]);

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
  const [isExportAuthorDialogOpen, setIsExportAuthorDialogOpen] =
    useState<boolean>(false);
  const [authorName, setAuthorName] = useState<string>("");
  const screenRef = useRef<SVGSVGElement>(null);

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
    setTempUpdatePaletteIndex(null);
    setIsInitialLoad(false); // Ce n'est plus le chargement initial
    // Ouvrir la popup
    setIsNewProjectDialogOpen(true);
  }

  function handleOpenPaletteDialog() {
    // Pré-remplir la palette temporaire avec la palette actuelle
    setTempPalette([...palette]);
    setTempUpdatePaletteIndex(null);
    setIsInitialLoad(false);
    setIsNewProjectDialogOpen(true);
  }

  function handleTempColorClick(colorHex: string) {
    // Si on est en mode update, remplacer la couleur
    if (tempUpdatePaletteIndex !== null) {
      const newTempPalette = [...tempPalette];
      newTempPalette[tempUpdatePaletteIndex] = colorHex;
      setTempPalette(newTempPalette);
      setTempUpdatePaletteIndex(null);
    } else {
      // Sinon, ajouter la couleur si on n'a pas atteint la limite
      if (tempPalette.length < MAX_PALETTE_COLORS) {
        setTempPalette([...tempPalette, colorHex]);
      }
    }
  }

  function handleEditPaletteColor(index: number) {
    // Activer le mode update pour cette couleur
    setTempUpdatePaletteIndex(index);
  }

  function handleDeletePaletteColor(index: number) {
    handleRemoveFromTempPalette(index);
    // Si on supprime la couleur en cours de modification, annuler le mode update
    if (tempUpdatePaletteIndex === index) {
      setTempUpdatePaletteIndex(null);
    } else if (
      tempUpdatePaletteIndex !== null &&
      tempUpdatePaletteIndex > index
    ) {
      // Ajuster l'index si on supprime une couleur avant celle en cours de modification
      setTempUpdatePaletteIndex(tempUpdatePaletteIndex - 1);
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

  function calculateColorQuantities() {
    const quantities: { [color: string]: number } = {};
    const totalPixels = GRID_HEIGHT * GRID_WIDTH;

    grid.pixels.forEach((row) => {
      row.forEach((pixel) => {
        if (pixel.paletteIndex !== null && palette[pixel.paletteIndex]) {
          const color = palette[pixel.paletteIndex];
          quantities[color] = (quantities[color] || 0) + 1;
        }
      });
    });

    return { quantities, totalPixels };
  }

  function handleExportClick() {
    setIsExportAuthorDialogOpen(true);
  }

  async function handleExportProject(author: string) {
    if (!screenRef.current) return;

    const svg = screenRef.current;
    const { quantities } = calculateColorQuantities();

    // Convertir SVG en image via canvas
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], {
      type: "image/svg+xml;charset=utf-8",
    });
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image();

    img.onload = async () => {
      // Créer un canvas pour convertir l'image en données
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(svgUrl);
        return;
      }
      ctx.drawImage(img, 0, 0);

      // Créer le PDF
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pdfWidth - 2 * margin;
      const contentHeight = pdfHeight - 2 * margin;

      // Calculer les dimensions de l'image pour qu'elle prenne le maximum de place
      const imgAspectRatio = img.width / img.height;
      // Utiliser 75% de la largeur disponible pour l'image
      let imgWidth = contentWidth * 0.75;
      let imgHeight = imgWidth / imgAspectRatio;

      // Si l'image est trop haute, ajuster pour utiliser 80% de la hauteur
      if (imgHeight > contentHeight * 0.8) {
        imgHeight = contentHeight * 0.8;
        imgWidth = imgHeight * imgAspectRatio;
      }

      // Ajouter l'image
      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", margin, margin + 15, imgWidth, imgHeight);

      // Ajouter le titre avec le crédit
      pdf.setFontSize(18);
      const titleText = `Ce projet a été créé avec amour par ${
        author || "Anonyme"
      }`;
      pdf.text(titleText, pdfWidth / 2, margin + 10, {
        align: "center",
      });

      // Constante : nombre de carrelages par boîte
      const TILES_PER_BOX = 28;

      // Ajouter les statistiques de couleurs
      const statsX = margin + imgWidth + 10;
      const statsY = margin + 25;
      pdf.setFontSize(12);
      pdf.text("Carrelages utilisés:", statsX, statsY);

      let yPos = statsY + 10;
      pdf.setFontSize(10);

      const sortedColors = Object.entries(quantities).sort(
        (a, b) => b[1] - a[1]
      );

      sortedColors.forEach(([color, count]) => {
        const colorIndex = palette.indexOf(color);
        const boxesNeeded = Math.ceil(count / TILES_PER_BOX);
        const totalTilesIfAllBoxes = boxesNeeded * TILES_PER_BOX;

        // Convertir la couleur hex en RGB pour jsPDF
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        // Carré de couleur
        pdf.setFillColor(r, g, b);
        pdf.rect(statsX, yPos - 3, 4, 4, "F");

        // Texte
        pdf.setTextColor(0, 0, 0);
        pdf.text(`Couleur ${colorIndex + 1}:`, statsX + 6, yPos);
        yPos += 6;
        pdf.text(
          `  ${count} carrelage${count > 1 ? "s" : ""}`,
          statsX + 6,
          yPos
        );
        yPos += 6;
        pdf.text(
          `  ${boxesNeeded} boîte${
            boxesNeeded > 1 ? "s" : ""
          } (${totalTilesIfAllBoxes} carrelages)`,
          statsX + 6,
          yPos
        );
        yPos += 10;
      });

      // Ajouter les informations sur le joint
      if (yPos > pdfHeight - 30) {
        // Si on dépasse, créer une nouvelle page ou ajuster
        yPos = statsY + 10;
      }

      pdf.setFontSize(12);
      pdf.text("Joint:", statsX, yPos);
      yPos += 8;
      pdf.setFontSize(10);

      // Convertir la couleur du joint hex en RGB
      const jointR = parseInt(jointColor.slice(1, 3), 16);
      const jointG = parseInt(jointColor.slice(3, 5), 16);
      const jointB = parseInt(jointColor.slice(5, 7), 16);

      // Carré de couleur du joint
      pdf.setFillColor(jointR, jointG, jointB);
      pdf.rect(statsX, yPos - 3, 4, 4, "F");

      // Texte
      pdf.setTextColor(0, 0, 0);
      pdf.text(`Couleur: ${jointColor}`, statsX + 6, yPos);

      // Sauvegarder le PDF
      pdf.save("projet-pixel41.pdf");
      URL.revokeObjectURL(svgUrl);
    };

    img.onerror = () => {
      console.error("Erreur lors du chargement de l'image SVG");
      URL.revokeObjectURL(svgUrl);
    };

    // Définir la taille de l'image pour une meilleure qualité
    const svgRect = svg.getBoundingClientRect();
    img.width = svgRect.width * 2; // 2x pour meilleure qualité
    img.height = svgRect.height * 2;
    img.src = svgUrl;
  }

  return (
    <>
      <Dialog
        open={isNewProjectDialogOpen}
        onOpenChange={handleDialogOpenChange}
      >
        <DialogContent
          className="!max-w-[1400px] w-[95vw] max-h-[90vh] overflow-hidden break-words p-0 flex sm:!max-w-[1400px]"
          showCloseButton={!isInitialLoad}
        >
          <div className="flex flex-row w-full h-full min-h-[600px]">
            {/* Côté gauche : Images d'inspiration */}
            <div className="w-1/2 relative overflow-hidden bg-muted min-h-full">
              <div className="absolute inset-0">
                {inspirationImages.map((img, index) => (
                  <img
                    key={img}
                    src={img}
                    alt={`Inspiration ${index + 1}`}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                      index === currentImageIndex ? "opacity-100" : "opacity-0"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Côté droit : Configuration de la palette */}
            <div className="w-1/2 flex flex-col p-6 overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  Nouveau projet - Configuration de la palette
                </DialogTitle>
                <DialogDescription>
                  Cliquez sur une couleur pour l'ajouter à votre palette
                  (jusqu'à {MAX_PALETTE_COLORS} couleurs). Survolez une couleur
                  de la palette pour voir les options de modification et
                  suppression.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4 w-full mt-4">
                <div className="flex flex-col gap-2 w-full">
                  <Badge>
                    Palette temporaire ({tempPalette.length}/
                    {MAX_PALETTE_COLORS})
                  </Badge>
                  {tempPalette.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-center">
                      {tempPalette.map((color, index) => (
                        <div
                          key={index}
                          className="flex flex-col items-center relative group"
                        >
                          <div
                            className={`w-12 h-12 rounded-full border-4 shadow border-white hover:scale-110 duration-75 relative ${
                              tempUpdatePaletteIndex === index
                                ? "palette-color-updating"
                                : ""
                            }`}
                            style={{ backgroundColor: color }}
                          >
                            {/* Icône crayon (gauche) */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditPaletteColor(index);
                              }}
                              className="absolute -left-1 -top-1 bg-background border border-border rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent z-10"
                              title="Modifier cette couleur"
                            >
                              <Pencil className="w-3 h-3 text-foreground" />
                            </button>
                            {/* Icône corbeille (droite) */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePaletteColor(index);
                              }}
                              className="absolute -right-1 -top-1 bg-background border border-border rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:border-destructive z-10"
                              title="Supprimer cette couleur"
                            >
                              <Trash2 className="w-3 h-3 text-foreground hover:text-destructive transition-colors" />
                            </button>
                          </div>
                          <Label className="text-xs mt-1">{index + 1}</Label>
                        </div>
                      ))}
                    </div>
                  )}
                  {tempPalette.length === 0 && (
                    <p className="text-xs text-center mt-2 text-gray-500">
                      Aucune couleur dans la palette. Cliquez sur une couleur
                      ci-dessous pour l'ajouter.
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2 w-full min-w-0">
                  <Badge className="break-words whitespace-normal text-wrap w-full max-w-full !whitespace-normal !w-full">
                    {tempUpdatePaletteIndex !== null
                      ? "Sélectionnez une nouvelle couleur pour remplacer la couleur en cours de modification"
                      : tempPalette.length >= MAX_PALETTE_COLORS
                      ? `Palette complète (${MAX_PALETTE_COLORS} couleurs)`
                      : "Cliquez sur une couleur pour l'ajouter à la palette"}
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
                        <Label className="text-xs mt-2 text-center break-words hyphens-auto max-w-full">
                          {color.name} {color.code}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter className="mt-4">
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
            </div>
          </div>
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
      <Dialog
        open={isExportAuthorDialogOpen}
        onOpenChange={setIsExportAuthorDialogOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nom de l'auteur</DialogTitle>
            <DialogDescription>
              Entrez votre nom pour l'inclure dans l'export du projet
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <Input
              placeholder="Votre nom"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && authorName.trim()) {
                  handleExportProject(authorName.trim());
                  setIsExportAuthorDialogOpen(false);
                  setAuthorName("");
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsExportAuthorDialogOpen(false);
                setAuthorName("");
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (authorName.trim()) {
                  handleExportProject(authorName.trim());
                  setIsExportAuthorDialogOpen(false);
                  setAuthorName("");
                }
              }}
              disabled={!authorName.trim()}
            >
              Exporter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="flex flex-row h-full gap-2">
        <Screen
          ref={screenRef}
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

          {/* Card Export */}
          <Card>
            <CardHeader>
              <CardTitle>Export</CardTitle>
              <CardDescription>
                Exportez votre projet en PDF avec les statistiques
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="default"
                onClick={handleExportClick}
                className="w-full"
                disabled={palette.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Exporter le projet
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

export default App;
