import { useEffect, useRef, useState } from "react";
import { Copy, DoorOpen, PenTool, Plus, Trash2, AlignHorizontalJustifyCenter, ChevronDown } from "lucide-react";
import type { Opening, OpeningKind, Surface } from "@/types";
import { Chip, ConfirmButton, NumField, Section, Segmented, TextField } from "../kit";
import { Button } from "../ui/button";
import { bboxOf, dist, isSelfIntersecting } from "@/lib/geometry";
import { cm, uid } from "@/lib/format";
import { OPENING_PRESETS, gableWall, lShape, rect, slopedWall } from "@/lib/defaults";
import {
  directionArrow,
  insertPoint,
  interiorAngle,
  isAxisRect,
  removePoint,
  resizeRect,
  setEdgeLength,
} from "@/lib/edit";
import type { Selection } from "@/lib/view";
import { cn } from "@/lib/utils";

interface Props {
  surface: Surface;
  change: (fn: (s: Surface) => Surface, tag?: string) => void;
  selection: Selection;
  onSelect: (s: Selection) => void;
  onDraw: () => void;
  onFit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  canDelete: boolean;
}

const r10 = (n: number) => Math.round(n / 10) * 10;

export function SurfacePanel({ surface, change, selection, onSelect, onDraw, onFit, onDuplicate, onDelete, canDelete }: Props) {
  const isFloor = surface.kind === "floor";
  const b = bboxOf(surface.outline);
  const bw = b.maxX - b.minX;
  const bh = b.maxY - b.minY;
  const axisRect = isAxisRect(surface.outline);
  const [showEdges, setShowEdges] = useState(!axisRect);
  const [showPoints, setShowPoints] = useState(false);
  const invalid = surface.outline.length >= 3 && isSelfIntersecting(surface.outline);
  const edgesRef = useRef<HTMLDivElement>(null);

  // un côté touché sur le dessin : on déplie la liste et on amène sa ligne à l'écran
  useEffect(() => {
    if (selection.edge === null || selection.edge === undefined) return;
    setShowEdges(true);
    const t = setTimeout(() => {
      const row = edgesRef.current?.querySelector<HTMLElement>(`[data-edge="${selection.edge}"]`);
      row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 60);
    return () => clearTimeout(t);
  }, [selection.edge]);

  useEffect(() => {
    if (!selection.opening) return;
    const t = setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-opening="${selection.opening}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 60);
    return () => clearTimeout(t);
  }, [selection.opening]);

  const applyTemplate = (outline: { x: number; y: number }[]) => {
    change((s) => ({ ...s, outline }));
    onSelect({ edge: null, opening: null });
    setTimeout(onFit, 30);
  };

  const addOpening = (p: { kind: OpeningKind; label: string; w: number; h: number; y: number }) => {
    const w = Math.min(p.w, bw);
    const h = Math.min(p.h, bh);
    const o: Opening = {
      id: uid(),
      kind: p.kind,
      label: p.label,
      w,
      h,
      x: Math.round(b.minX + (bw - w) / 2),
      y: isFloor ? Math.round(b.minY + (bh - h) / 2) : b.minY + Math.min(p.y, Math.max(0, bh - h)),
    };
    change((s) => ({ ...s, openings: [...s.openings, o] }));
    onSelect({ edge: null, opening: o.id });
  };

  const updOpening = (id: string, patch: Partial<Opening>, tag: string) =>
    change((s) => ({ ...s, openings: s.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)) }), tag);

  return (
    <div>
      <Section
        title={isFloor ? "Sol · vue en plan" : "Mur · élévation"}
        right={
          <div className="flex gap-1">
            <Button variant="ghost" size="icon-sm" title="Dupliquer la surface" onClick={onDuplicate}>
              <Copy />
            </Button>
            <ConfirmButton title="Supprimer la surface" disabled={!canDelete} onConfirm={onDelete}>
              <Trash2 />
            </ConfirmButton>
          </div>
        }
      >
        <TextField label="Nom" value={surface.name} onChange={(v) => change((s) => ({ ...s, name: v }), "name")} />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {isFloor ? (
            <>
              <Chip onClick={() => applyTemplate(rect(r10(bw), r10(bh)))}>Rectangle</Chip>
              <Chip onClick={() => applyTemplate(lShape(r10(bw), r10(bh), r10(bw * 0.4), r10(bh * 0.4)))}>En L</Chip>
            </>
          ) : (
            <>
              <Chip onClick={() => applyTemplate(rect(r10(bw), r10(bh)))}>Mur droit</Chip>
              <Chip onClick={() => applyTemplate(slopedWall(r10(bw), r10(bh), r10(Math.min(bh, 1000)), r10(bw * 0.45)))}>
                Sous rampant
              </Chip>
              <Chip onClick={() => applyTemplate(gableWall(r10(bw), r10(bh * 0.6), r10(bh)))}>Pignon</Chip>
            </>
          )}
          <Chip onClick={onDraw}>
            <span className="inline-flex items-center gap-1">
              <PenTool className="size-3.5" /> Dessiner
            </span>
          </Chip>
        </div>
        {invalid && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            Le contour se croise lui-même : vérifiez les longueurs ou déplacez les points.
          </p>
        )}
      </Section>

      <Section title="Dimensions">
        {axisRect && (
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label={isFloor ? "Longueur" : "Largeur du mur"}
              value={bw}
              min={10}
              onChange={(v) => change((s) => resizeRect(s, v, bh), "rect-w")}
            />
            <NumField
              label={isFloor ? "Largeur" : "Hauteur du mur"}
              value={bh}
              min={10}
              onChange={(v) => change((s) => resizeRect(s, bw, v), "rect-h")}
            />
          </div>
        )}
        {!axisRect && (
          <p className="text-xs text-muted-foreground">
            Encombrement {cm(bw)} × {cm(bh)} cm · touchez un côté du dessin pour le sélectionner.
          </p>
        )}
        <button
          type="button"
          className="mt-3 flex w-full items-center justify-between text-left text-sm font-medium"
          onClick={() => setShowEdges((v) => !v)}
        >
          Côtés ({surface.outline.length})
          <ChevronDown className={cn("size-4 transition", showEdges && "rotate-180")} />
        </button>
        {showEdges && (
          <div ref={edgesRef} className="mt-2 space-y-1.5">
            {surface.outline.map((a, i) => {
              const nb = surface.outline[(i + 1) % surface.outline.length];
              const sel = selection.edge === i;
              return (
                <div
                  key={i}
                  data-edge={i}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-1.5 py-1",
                    sel ? "bg-blue-50 ring-1 ring-blue-300" : "hover:bg-muted/60"
                  )}
                  onClick={() => onSelect({ edge: i, opening: null })}
                >
                  <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">
                    {directionArrow(a, nb)} {i + 1}
                  </span>
                  <NumField
                    className="flex-1"
                    value={dist(a, nb)}
                    min={1}
                    onChange={(v) => change((s) => setEdgeLength(s, i, v), `edge-${i}`)}
                  />
                  <button
                    type="button"
                    title="Insérer un point au milieu"
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      change((s) => insertPoint(s, i));
                    }}
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              );
            })}
            <p className="pt-1 text-[11px] leading-snug text-muted-foreground">
              Modifier un côté déplace son extrémité et translate le côté suivant (les angles droits sont conservés).
            </p>
          </div>
        )}
        <button
          type="button"
          className="mt-3 flex w-full items-center justify-between text-left text-sm font-medium"
          onClick={() => setShowPoints((v) => !v)}
        >
          Coordonnées des points
          <ChevronDown className={cn("size-4 transition", showPoints && "rotate-180")} />
        </button>
        {showPoints && (
          <div className="mt-2 space-y-1.5">
            {surface.outline.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-xs font-medium text-muted-foreground">{i + 1}</span>
                <NumField
                  className="flex-1"
                  value={p.x}
                  onChange={(v) =>
                    change((s) => ({ ...s, outline: s.outline.map((q, k) => (k === i ? { ...q, x: v } : q)) }), `px-${i}`)
                  }
                />
                <NumField
                  className="flex-1"
                  value={p.y}
                  onChange={(v) =>
                    change((s) => ({ ...s, outline: s.outline.map((q, k) => (k === i ? { ...q, y: v } : q)) }), `py-${i}`)
                  }
                />
                <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                  {Math.round(interiorAngle(surface.outline, i))}°
                </span>
                <button
                  type="button"
                  title="Supprimer ce point"
                  disabled={surface.outline.length <= 3}
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                  onClick={() => change((s) => removePoint(s, i))}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <p className="pt-1 text-[11px] text-muted-foreground">x, y en cm · angle intérieur à droite.</p>
          </div>
        )}
      </Section>

      {!isFloor && (
        <Section title="Hauteur carrelée">
          <Segmented
            value={surface.band ? "part" : "full"}
            options={[
              { value: "full", label: "Toute la hauteur" },
              { value: "part", label: "Partielle" },
            ]}
            onChange={(v) =>
              change((s) => ({ ...s, band: v === "full" ? null : { from: b.minY, to: Math.min(b.maxY, b.minY + 1200) } }))
            }
          />
          {surface.band && (
            <>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <NumField
                  label="Depuis (sol)"
                  value={surface.band.from}
                  min={0}
                  onChange={(v) => change((s) => ({ ...s, band: { ...s.band!, from: v } }), "band-from")}
                />
                <NumField
                  label="Jusqu'à"
                  value={surface.band.to}
                  min={0}
                  onChange={(v) => change((s) => ({ ...s, band: { ...s.band!, to: v } }), "band-to")}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[
                  { l: "Soubassement 120", f: 0, t: 1200 },
                  { l: "Douche 210", f: 0, t: 2100 },
                  { l: "Crédence 90 → 150", f: 900, t: 1500 },
                ].map((p) => (
                  <Chip
                    key={p.l}
                    active={surface.band?.from === p.f && surface.band?.to === p.t}
                    onClick={() => change((s) => ({ ...s, band: { from: p.f, to: p.t } }))}
                  >
                    {p.l}
                  </Chip>
                ))}
              </div>
            </>
          )}
        </Section>
      )}

      <Section title={isFloor ? "Obstacles non carrelés" : "Ouvertures & obstacles"}>
        <div className="flex flex-wrap gap-1.5">
          {OPENING_PRESETS[surface.kind].map((p) => (
            <Chip key={p.label} onClick={() => addOpening(p)}>
              + {p.label}
            </Chip>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          {surface.openings.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {isFloor
                ? "Ajoutez les zones à ne pas carreler (baignoire, îlot, placard…)."
                : "Ajoutez portes, fenêtres et meubles : ils seront exclus du calepinage."}
            </p>
          )}
          {surface.openings.map((o) => {
            const sel = selection.opening === o.id;
            return (
              <div
                key={o.id}
                data-opening={o.id}
                className={cn("rounded-lg border bg-white p-2.5", sel && "border-blue-400 ring-2 ring-blue-100")}
                onClick={() => !sel && onSelect({ edge: null, opening: o.id })}
              >
                <div className="flex items-center gap-2">
                  <DoorOpen className="size-4 shrink-0 text-muted-foreground" />
                  <TextField value={o.label} onChange={(v) => updOpening(o.id, { label: v }, `ol-${o.id}`)} className="h-8" />
                  <button
                    type="button"
                    title="Centrer horizontalement"
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                    onClick={(e) => {
                      e.stopPropagation();
                      updOpening(o.id, { x: Math.round((b.minX + (bw - o.w) / 2) * 10) / 10 }, "center");
                    }}
                  >
                    <AlignHorizontalJustifyCenter className="size-4" />
                  </button>
                  <button
                    type="button"
                    title="Supprimer"
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                    onClick={(e) => {
                      e.stopPropagation();
                      change((s) => ({ ...s, openings: s.openings.filter((q) => q.id !== o.id) }));
                      onSelect({ edge: null, opening: null });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                {sel && (
                  <div className="mt-2.5 space-y-2.5">
                    {!isFloor && (
                      <Segmented
                        size="sm"
                        value={o.kind}
                        options={[
                          { value: "door", label: "Porte" },
                          { value: "window", label: "Fenêtre" },
                          { value: "obstacle", label: "Autre" },
                        ]}
                        onChange={(k) => updOpening(o.id, { kind: k, ...(k === "door" ? { y: b.minY } : {}) }, "kind")}
                      />
                    )}
                    <div className="grid grid-cols-2 gap-2.5">
                      <NumField
                        label={isFloor ? "Depuis la gauche" : "Depuis la gauche"}
                        value={o.x - b.minX}
                        onChange={(v) => updOpening(o.id, { x: b.minX + v }, `ox-${o.id}`)}
                      />
                      <NumField
                        label={isFloor ? "Depuis le bas" : o.kind === "window" ? "Allège (depuis le sol)" : "Depuis le sol"}
                        value={o.y - b.minY}
                        disabled={!isFloor && o.kind === "door"}
                        onChange={(v) => updOpening(o.id, { y: b.minY + v }, `oy-${o.id}`)}
                      />
                      <NumField
                        label="Largeur"
                        value={o.w}
                        min={1}
                        onChange={(v) => updOpening(o.id, { w: v }, `ow-${o.id}`)}
                      />
                      <NumField
                        label={isFloor ? "Profondeur" : "Hauteur"}
                        value={o.h}
                        min={1}
                        onChange={(v) => updOpening(o.id, { h: v }, `oh-${o.id}`)}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
