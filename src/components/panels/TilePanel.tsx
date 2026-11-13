import { useState } from "react";
import { ArrowLeftRight, Brush, Eraser, Plus, Shuffle, X } from "lucide-react";
import type { ColorMode, Surface } from "@/types";
import { Chip, NumField, Section, Segmented, TextField } from "../kit";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { TILE_PRESETS } from "@/lib/defaults";
import { JOINT_COLORS, LIBRARIES, colorName, contrastText } from "@/lib/palettes";
import { cn } from "@/lib/utils";
import type { Tool } from "../Viewport";

interface Props {
  surface: Surface;
  change: (fn: (s: Surface) => Surface, tag?: string) => void;
  tool: Tool;
  setTool: (t: Tool) => void;
  paintColor: number;
  setPaintColor: (n: number) => void;
}

export function TilePanel({ surface, change, tool, setTool, paintColor, setPaintColor }: Props) {
  const t = surface.tile;
  const c = surface.colors;
  const hex = surface.pattern.type === "hexagon";
  const opus = surface.pattern.type === "opus";
  const pin = surface.pattern.type === "pinwheel";
  const square = hex || opus || pin;
  const [pickFor, setPickFor] = useState<number | null>(null);
  const painted = Object.keys(c.paint).length;

  const setTile = (patch: Partial<Surface["tile"]>, tag?: string) => change((s) => ({ ...s, tile: { ...s.tile, ...patch } }), tag);
  const setColors = (patch: Partial<Surface["colors"]>, tag?: string) =>
    change((s) => ({ ...s, colors: { ...s.colors, ...patch } }), tag);

  const pick = (hexColor: string) => {
    if (pickFor === null) return;
    setColors({ palette: c.palette.map((p, i) => (i === pickFor ? hexColor : p)) });
    setPickFor(null);
  };

  const addColor = () => {
    const suggestions = LIBRARIES[0].colors.map((x) => x.hex);
    const next = suggestions.find((h) => !c.palette.includes(h)) ?? "#888888";
    const idx = c.palette.length;
    setColors({ palette: [...c.palette, next], weights: [...c.palette.map((_, i) => c.weights[i] ?? 1), 1] });
    setPaintColor(idx);
    setPickFor(idx);
  };

  const removeColor = (idx: number) => {
    if (c.palette.length <= 1) return;
    change((s) => {
      const paint: Record<string, number> = {};
      for (const [k, v] of Object.entries(s.colors.paint)) {
        if (v === idx) continue;
        paint[k] = v > idx ? v - 1 : v;
      }
      return {
        ...s,
        colors: {
          ...s.colors,
          palette: s.colors.palette.filter((_, i) => i !== idx),
          weights: s.colors.weights.filter((_, i) => i !== idx),
          paint,
        },
      };
    });
    if (paintColor >= c.palette.length - 1) setPaintColor(Math.max(0, c.palette.length - 2));
  };

  const totalWeight = c.palette.reduce((s, _, i) => s + Math.max(0, c.weights[i] ?? 1), 0) || 1;

  return (
    <div>
      <Section title="Format du carreau">
        <TextField label="Référence" value={t.name} onChange={(v) => setTile({ name: v }, "tname")} />
        <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {TILE_PRESETS.map((p) => (
            <Chip
              key={p.label}
              active={t.w === p.w && t.h === p.h && t.joint === p.joint}
              onClick={() => setTile({ w: p.w, h: p.h, joint: p.joint, thickness: p.thickness })}
            >
              {p.label}
            </Chip>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 items-end gap-3">
          <NumField
            label={hex ? "Largeur plat à plat" : pin ? "Grand carreau" : opus ? "Petit module" : "Largeur"}
            value={t.w}
            min={5}
            onChange={(v) => setTile(square ? { w: v, h: v } : { w: v }, "tw")}
          />
          {!square ? (
            <div className="flex items-end gap-1.5">
              <NumField className="flex-1" label="Hauteur" value={t.h} min={5} onChange={(v) => setTile({ h: v }, "th")} />
              <Button variant="outline" size="icon" title="Inverser largeur et hauteur" onClick={() => setTile({ w: t.h, h: t.w })}>
                <ArrowLeftRight />
              </Button>
            </div>
          ) : (
            <div />
          )}
          <NumField label="Joint" unit="mm" value={t.joint} min={0} max={30} onChange={(v) => setTile({ joint: v }, "tj")} />
          <NumField label="Épaisseur" unit="mm" value={t.thickness} min={1} max={60} onChange={(v) => setTile({ thickness: v }, "tt")} />
        </div>
      </Section>

      <Section title="Couleur des joints">
        <div className="flex flex-wrap items-center gap-2">
          {JOINT_COLORS.map((j) => (
            <button
              key={j.hex}
              type="button"
              title={j.name}
              onClick={() => setTile({ jointColor: j.hex })}
              className={cn(
                "size-8 rounded-full border shadow-sm",
                t.jointColor.toLowerCase() === j.hex && "ring-2 ring-foreground ring-offset-2"
              )}
              style={{ background: j.hex }}
            />
          ))}
          <label className="relative size-8 cursor-pointer overflow-hidden rounded-full border shadow-sm" title="Autre couleur">
            <input
              type="color"
              value={t.jointColor}
              onChange={(e) => setTile({ jointColor: e.target.value }, "jc")}
              className="absolute -inset-2 size-12 cursor-pointer"
            />
          </label>
        </div>
      </Section>

      <Section
        title="Couleurs des carreaux"
        right={
          c.mode === "random" ? (
            <Button variant="ghost" size="sm" onClick={() => setColors({ seed: Math.floor(Math.random() * 1e6) })}>
              <Shuffle /> Remélanger
            </Button>
          ) : null
        }
      >
        <Segmented<ColorMode>
          size="sm"
          value={c.mode}
          onChange={(mode) => setColors({ mode })}
          options={[
            { value: "single", label: "Uni" },
            { value: "checker", label: "Damier" },
            { value: "rows", label: "Rangées" },
            { value: "cols", label: "Colonnes" },
            { value: "random", label: "Mélange" },
          ]}
        />
        <div className="mt-3 space-y-1.5">
          {c.palette.map((p, i) => {
            const active = tool === "paint" && paintColor === i;
            return (
              <div key={i} className={cn("flex items-center gap-2 rounded-lg p-1", active && "bg-muted")}>
                <button
                  type="button"
                  onClick={() => setPickFor(i)}
                  className="flex size-9 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold shadow-sm"
                  style={{ background: p, color: contrastText(p) }}
                  title="Changer la couleur"
                >
                  {i + 1}
                </button>
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-sm"
                  onClick={() => {
                    setPaintColor(i);
                    setTool("paint");
                  }}
                  title="Peindre avec cette couleur"
                >
                  {colorName(p)}
                  {(c.mode === "single" && i > 0) || (c.mode === "checker" && i > 1) ? (
                    <span className="ml-1 text-xs text-muted-foreground">(peinture)</span>
                  ) : null}
                </button>
                {c.mode === "random" && (
                  <div className="flex w-24 shrink-0 items-center gap-1">
                    <NumField
                      unit="%"
                      digits={0}
                      value={Math.round(((c.weights[i] ?? 1) / totalWeight) * 100)}
                      min={0}
                      max={100}
                      onChange={(v) => {
                        // fixe la part de cette couleur en conservant les proportions des autres
                        const others = totalWeight - (c.weights[i] ?? 1);
                        const share = Math.min(99.9, v) / 100;
                        const w = others <= 0 ? 1 : (share * others) / (1 - share);
                        setColors({ weights: c.palette.map((_, k) => (k === i ? w : c.weights[k] ?? 1)) }, `w-${i}`);
                      }}
                    />
                  </div>
                )}
                <button
                  type="button"
                  title="Retirer"
                  disabled={c.palette.length <= 1}
                  onClick={() => removeColor(i)}
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                >
                  <X className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={addColor} disabled={c.palette.length >= 16}>
            <Plus /> Couleur
          </Button>
          <Button variant={tool === "paint" ? "default" : "outline"} size="sm" onClick={() => setTool(tool === "paint" ? "select" : "paint")}>
            <Brush /> Peindre
          </Button>
          {tool === "paint" && (
            <Button variant={paintColor < 0 ? "default" : "outline"} size="sm" onClick={() => setPaintColor(-1)}>
              <Eraser /> Gomme
            </Button>
          )}
          {painted > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setColors({ paint: {} })}>
              Effacer la peinture ({painted})
            </Button>
          )}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          « Peindre » : touchez ou glissez sur les carreaux pour leur appliquer la couleur choisie (motifs, frises, pixel art).
        </p>
      </Section>

      <Section title="Conditionnement & prix">
        <div className="grid grid-cols-2 gap-3">
          <NumField
            label="Carreaux par carton"
            unit="u"
            digits={0}
            value={t.perBox}
            min={0}
            onChange={(v) => setTile({ perBox: Math.round(v) }, "pb")}
          />
          <NumField label="Prix au m²" unit="€" value={t.pricePerM2} min={0} onChange={(v) => setTile({ pricePerM2: v }, "price")} />
        </div>
      </Section>

      <Dialog open={pickFor !== null} onOpenChange={(o) => !o && setPickFor(null)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Choisir une couleur</DialogTitle>
            <DialogDescription>Nuanciers prédéfinis ou couleur libre.</DialogDescription>
          </DialogHeader>
          <label className="flex items-center gap-3 rounded-lg border p-2 text-sm">
            <input
              type="color"
              value={pickFor !== null && c.palette[pickFor] ? c.palette[pickFor] : "#888888"}
              onChange={(e) => {
                if (pickFor === null) return;
                setColors({ palette: c.palette.map((p, i) => (i === pickFor ? e.target.value : p)) }, `pick-${pickFor}`);
              }}
              className="size-10 cursor-pointer"
            />
            Couleur libre
          </label>
          {LIBRARIES.map((lib) => (
            <div key={lib.name}>
              <div className="mb-2 text-sm font-semibold">{lib.name}</div>
              <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                {lib.colors.map((col) => (
                  <button
                    key={col.hex + col.name}
                    type="button"
                    onClick={() => pick(col.hex)}
                    className="group flex flex-col items-center gap-0.5"
                    title={col.name}
                  >
                    <span className="aspect-square w-full rounded-md border shadow-sm group-hover:scale-105" style={{ background: col.hex }} />
                    <span className="w-full truncate text-center text-[10px] text-muted-foreground">{col.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
