import { useState } from "react";
import type { Surface, SurfaceKind } from "@/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { NumField, Segmented, TextField } from "./kit";
import { lShape, newSurface, rect, slopedWall } from "@/lib/defaults";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (kind: SurfaceKind, s: Surface) => void;
}

type Shape = "rect" | "l" | "slope";

export function AddSurfaceDialog({ open, onOpenChange, onCreate }: Props) {
  const [kind, setKind] = useState<SurfaceKind>("floor");
  const [name, setName] = useState("");
  const [shape, setShape] = useState<Shape>("rect");
  const [w, setW] = useState(3600);
  const [h, setH] = useState(2800);

  const switchKind = (k: SurfaceKind) => {
    setKind(k);
    setShape("rect");
    if (k === "wall") {
      setW(3000);
      setH(2500);
    } else {
      setW(3600);
      setH(2800);
    }
  };

  const create = () => {
    const outline =
      shape === "l"
        ? lShape(w, h, Math.round((w * 0.4) / 10) * 10, Math.round((h * 0.4) / 10) * 10)
        : shape === "slope"
          ? slopedWall(w, h, Math.min(h, 1000), Math.round((w * 0.45) / 10) * 10)
          : rect(w, h);
    const s = newSurface(kind, name.trim() || (kind === "floor" ? "Sol" : "Mur"), outline);
    onCreate(kind, s);
    setName("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle surface</DialogTitle>
          <DialogDescription>Un sol se dessine en plan, un mur en élévation (vue de face).</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { k: "floor", t: "Sol", d: "Vue en plan, obstacles" },
              { k: "wall", t: "Mur", d: "Élévation, portes et fenêtres" },
            ] as const
          ).map((o) => (
            <button
              key={o.k}
              type="button"
              onClick={() => switchKind(o.k)}
              className={cn(
                "rounded-lg border p-3 text-left transition",
                kind === o.k ? "border-foreground ring-2 ring-foreground/10" : "hover:bg-muted"
              )}
            >
              <div className="font-semibold">{o.t}</div>
              <div className="text-xs text-muted-foreground">{o.d}</div>
            </button>
          ))}
        </div>
        <TextField label="Nom" value={name} placeholder={kind === "floor" ? "Sol salle de bain" : "Mur douche"} onChange={setName} />
        <Segmented<Shape>
          size="sm"
          value={shape}
          onChange={setShape}
          options={
            kind === "floor"
              ? [
                  { value: "rect", label: "Rectangle" },
                  { value: "l", label: "En L" },
                ]
              : [
                  { value: "rect", label: "Mur droit" },
                  { value: "slope", label: "Sous rampant" },
                ]
          }
        />
        <div className="grid grid-cols-2 gap-3">
          <NumField label={kind === "floor" ? "Longueur" : "Largeur"} value={w} min={10} onChange={setW} />
          <NumField label={kind === "floor" ? "Largeur" : "Hauteur"} value={h} min={10} onChange={setH} />
        </div>
        <p className="text-xs text-muted-foreground">
          Le contour reste modifiable ensuite (longueur de chaque côté, points, tracé libre).
        </p>
        <DialogFooter>
          <Button onClick={create}>Créer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
