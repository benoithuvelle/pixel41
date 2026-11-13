import { useMemo, useRef, useState } from "react";
import { Hand, RotateCcw, Sparkles } from "lucide-react";
import type { Align, PatternType, Surface } from "@/types";
import { Chip, NumField, Section, Segmented, Toggle } from "../kit";
import { Button } from "../ui/button";
import { PATTERN_HINTS, PATTERN_LABELS, buildPattern, generateTiles } from "@/lib/patterns";
import { optimizeOffset } from "@/lib/layout";
import { cm } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Tool } from "../Viewport";
import type { DrawingOptions } from "@/lib/view";

interface Props {
  surface: Surface;
  change: (fn: (s: Surface) => Surface, tag?: string) => void;
  tool: Tool;
  setTool: (t: Tool) => void;
  display: DrawingOptions;
  setDisplay: (d: DrawingOptions) => void;
  warnings: string[];
}

const PATTERNS: PatternType[] = ["grid", "offset", "herringbone", "chevron", "basket", "hexagon", "pinwheel", "opus"];

export function PosePanel({ surface, change, tool, setTool, display, setDisplay, warnings }: Props) {
  const p = surface.pattern;
  const l = surface.layout;
  const isWall = surface.kind === "wall";
  const [progress, setProgress] = useState<number | null>(null);
  const stop = useRef(false);

  const setPattern = (patch: Partial<Surface["pattern"]>, tag?: string) =>
    change((s) => ({ ...s, pattern: { ...s.pattern, ...patch } }), tag);
  const setLayout = (patch: Partial<Surface["layout"]>, tag?: string) =>
    change((s) => ({ ...s, layout: { ...s.layout, ...patch } }), tag);

  const choosePattern = (type: PatternType) => {
    change((s) => {
      const tile = { ...s.tile };
      const pattern = { ...s.pattern, type };
      const layout = { ...s.layout, offsetX: 0, offsetY: 0 };
      // formats cohérents avec le motif choisi
      if (type === "herringbone" || type === "chevron") {
        if (Math.max(tile.w, tile.h) < 2 * Math.min(tile.w, tile.h)) {
          tile.w = 600;
          tile.h = 150;
        }
        if (type === "herringbone") layout.angle = s.kind === "floor" ? 45 : 0;
        if (type === "chevron") layout.angle = s.kind === "floor" ? 0 : 90;
      } else if (type === "basket") {
        if (Math.max(tile.w, tile.h) < 1.8 * Math.min(tile.w, tile.h)) {
          tile.w = 200;
          tile.h = 100;
        }
        layout.angle = 0;
      } else if (type === "hexagon" || type === "pinwheel" || type === "opus") {
        const side = type === "opus" ? Math.min(tile.w, tile.h, 200) : Math.min(tile.w, tile.h);
        tile.w = side;
        tile.h = side;
        if (type === "pinwheel") pattern.smallSize = Math.round(((side - tile.joint) / 2) * 10) / 10;
        layout.angle = 0;
      } else if (s.pattern.type === "herringbone" || s.pattern.type === "chevron") {
        layout.angle = 0;
      }
      return { ...s, tile, pattern, layout };
    });
  };

  const runOptimize = async () => {
    stop.current = false;
    setProgress(0);
    try {
      const off = await optimizeOffset(surface, setProgress, () => stop.current);
      if (!stop.current) setLayout({ offsetX: off.x, offsetY: off.y });
    } finally {
      setProgress(null);
    }
  };

  const xOpts: { value: Align; label: string }[] = [
    { value: "start", label: "Gauche" },
    { value: "center", label: "Centre" },
    { value: "joint", label: "Joint centré" },
    { value: "end", label: "Droite" },
  ];
  const yOpts: { value: Align; label: string }[] = [
    { value: "start", label: isWall ? "Sol" : "Bas" },
    { value: "center", label: "Centre" },
    { value: "joint", label: "Joint centré" },
    { value: "end", label: "Haut" },
  ];

  const opusFormats = useMemo(() => {
    if (p.type !== "opus") return null;
    return buildPattern(surface.tile, p).formats.map((f) => f.label);
  }, [p, surface.tile]);

  return (
    <div>
      <Section title="Motif de pose">
        <div className="grid grid-cols-4 gap-2">
          {PATTERNS.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => choosePattern(type)}
              title={PATTERN_HINTS[type]}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border bg-white p-1.5 text-[11px] font-medium leading-tight transition",
                p.type === type ? "border-foreground ring-2 ring-foreground/15" : "hover:bg-muted"
              )}
            >
              <PatternThumb type={type} />
              <span className="w-full truncate text-center">{PATTERN_LABELS[type]}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{PATTERN_HINTS[p.type]}</p>

        {p.type === "offset" && (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { v: 0.5, l: "½" },
                { v: 1 / 3, l: "⅓" },
                { v: 0.25, l: "¼" },
                { v: 0.2, l: "⅕" },
              ].map((o) => (
                <Chip key={o.l} active={Math.abs(p.offsetRatio - o.v) < 1e-6} onClick={() => setPattern({ offsetRatio: o.v })}>
                  Décalage {o.l}
                </Chip>
              ))}
              <NumField
                className="w-24"
                unit="%"
                digits={1}
                value={p.offsetRatio * 100}
                min={0}
                max={95}
                onChange={(v) => setPattern({ offsetRatio: v / 100 }, "ratio")}
              />
            </div>
            <Segmented
              size="sm"
              value={p.offsetDir}
              onChange={(v) => setPattern({ offsetDir: v })}
              options={[
                { value: "rows", label: "Rangées horizontales" },
                { value: "cols", label: "Colonnes verticales" },
              ]}
            />
          </div>
        )}
        {p.type === "chevron" && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {[30, 45, 60].map((a) => (
              <Chip key={a} active={p.chevronAngle === a} onClick={() => setPattern({ chevronAngle: a })}>
                {a}°
              </Chip>
            ))}
            <NumField className="w-24" unit="°" value={p.chevronAngle} min={20} max={70} onChange={(v) => setPattern({ chevronAngle: v }, "chev")} />
            <p className="w-full text-[11px] text-muted-foreground">Longueur = grand côté de la lame, largeur = petit côté.</p>
          </div>
        )}
        {p.type === "pinwheel" && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <NumField
              label="Petit carreau (cabochon)"
              value={p.smallSize}
              min={5}
              max={surface.tile.w - 1}
              onChange={(v) => setPattern({ smallSize: v }, "small")}
            />
          </div>
        )}
        {p.type === "opus" && opusFormats && (
          <p className="mt-3 text-xs text-muted-foreground">
            Formats (cm) : {opusFormats.join(" · ")}. Le module se règle avec la largeur du petit carreau (onglet Carrelage).
            Proportions : 2 grands, 2 moyens, 2 rectangles, 1 petit.
          </p>
        )}
        {warnings.map((w) => (
          <p key={w} className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {w}
          </p>
        ))}
      </Section>

      <Section title="Orientation">
        <div className="flex flex-wrap items-center gap-1.5">
          {[0, 45, 90, -45].map((a) => (
            <Chip key={a} active={l.angle === a} onClick={() => setLayout({ angle: a })}>
              {a === 45 ? "45° (diagonale)" : `${a}°`}
            </Chip>
          ))}
          <NumField className="w-24" unit="°" value={l.angle} min={-180} max={180} onChange={(v) => setLayout({ angle: v }, "angle")} />
        </div>
      </Section>

      <Section
        title="Point de départ"
        right={
          (l.offsetX !== 0 || l.offsetY !== 0) && (
            <Button variant="ghost" size="sm" onClick={() => setLayout({ offsetX: 0, offsetY: 0 })}>
              <RotateCcw /> Recaler
            </Button>
          )
        }
      >
        <div className="space-y-2.5">
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Horizontal</div>
            <Segmented size="sm" value={l.alignX} options={xOpts} onChange={(v) => setLayout({ alignX: v, offsetX: 0 })} />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Vertical</div>
            <Segmented size="sm" value={l.alignY} options={yOpts} onChange={(v) => setLayout({ alignY: v, offsetY: 0 })} />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <NumField label="Décalage X" value={l.offsetX} onChange={(v) => setLayout({ offsetX: v }, "ox")} />
            <NumField label="Décalage Y" value={l.offsetY} onChange={(v) => setLayout({ offsetY: v }, "oy")} />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant={tool === "move" ? "default" : "outline"} size="sm" onClick={() => setTool(tool === "move" ? "select" : "move")}>
              <Hand /> Glisser la pose
            </Button>
            {progress === null ? (
              <Button variant="outline" size="sm" onClick={runOptimize}>
                <Sparkles /> Optimiser les coupes
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => (stop.current = true)}>
                Optimisation… {Math.round(progress * 100)} % (arrêter)
              </Button>
            )}
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            « Centre » : coupes symétriques de part et d'autre. « Optimiser » cherche le calage qui évite les coupes
            inférieures au seuil puis minimise le nombre de carreaux.
          </p>
        </div>
      </Section>

      <Section title="Coupes">
        <div className="mb-1 text-xs font-medium text-muted-foreground">Signaler les coupes plus petites que</div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { v: 0.2, l: "⅕" },
            { v: 0.25, l: "¼" },
            { v: 1 / 3, l: "⅓" },
            { v: 0.5, l: "½" },
          ].map((o) => (
            <Chip key={o.l} active={Math.abs(surface.minCut - o.v) < 1e-6} onClick={() => change((s) => ({ ...s, minCut: o.v }))}>
              {o.l} de carreau
            </Chip>
          ))}
        </div>
        <div className="mt-3">
          <Toggle
            label={
              <span>
                Hachurer les coupes <span className="ml-1 inline-block size-2.5 rounded-sm bg-blue-500/40" />{" "}
                <span className="inline-block size-2.5 rounded-sm bg-red-600/60" /> petites
              </span>
            }
            checked={display.showCuts}
            onChange={(v) => setDisplay({ ...display, showCuts: v })}
          />
          <Toggle
            label="Cotes des coupes (cm)"
            checked={display.showCutLabels}
            onChange={(v) => setDisplay({ ...display, showCutLabels: v })}
          />
          <Toggle label="Cotes de la surface" checked={display.showDims} onChange={(v) => setDisplay({ ...display, showDims: v })} />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Repère : la largeur/hauteur du carreau de départ vaut {cm(surface.tile.w)} × {cm(surface.tile.h)} cm.
        </p>
      </Section>
    </div>
  );
}

const thumbCache = new Map<PatternType, string>();

function PatternThumb({ type }: { type: PatternType }) {
  const d = useMemo(() => {
    const cached = thumbCache.get(type);
    if (cached) return cached;
    const tiles: Record<PatternType, [number, number]> = {
      grid: [300, 300],
      offset: [600, 300],
      herringbone: [400, 100],
      chevron: [400, 110],
      basket: [270, 80],
      hexagon: [260, 260],
      pinwheel: [300, 300],
      opus: [150, 150],
    };
    const [w, h] = tiles[type];
    const def = buildPattern(
      { name: "", w, h, joint: 30, thickness: 8, perBox: 0, pricePerM2: 0, jointColor: "" },
      { type, offsetRatio: 0.5, offsetDir: "rows", chevronAngle: 45, smallSize: 135 }
    );
    const angle = type === "herringbone" ? Math.PI / 4 : 0;
    const R = 900;
    const gen = generateTiles(def, { minX: -R * 1.5, minY: -R * 1.5, maxX: R * 1.5, maxY: R * 1.5 });
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const path = gen
      .map((t) => {
        const pts = t.poly.map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }));
        return "M" + pts.map((p) => `${Math.round(p.x)} ${Math.round(-p.y)}`).join("L") + "Z";
      })
      .join("");
    thumbCache.set(type, path);
    return path;
  }, [type]);
  return (
    <svg viewBox="-900 -900 1800 1800" className="aspect-square w-full rounded bg-zinc-400">
      <path d={d} fill="#f4f1ea" />
    </svg>
  );
}
