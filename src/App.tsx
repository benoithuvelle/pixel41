import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Brush,
  Check,
  FolderOpen,
  Grid2x2,
  Hand,
  LayoutTemplate,
  Maximize,
  MousePointer2,
  PenTool,
  Plus,
  Redo2,
  Ruler,
  Undo2,
  X,
} from "lucide-react";
import type { Project, Surface, SurfaceKind, Vec } from "@/types";
import { useProjectStore } from "@/store";
import { cachedLayout, computeLayout, recolor } from "@/lib/layout";
import { Viewport, type Tool, type ViewportHandle } from "@/components/Viewport";
import type { DrawingOptions, Selection } from "@/lib/view";
import { SurfacePanel } from "@/components/panels/SurfacePanel";
import { TilePanel } from "@/components/panels/TilePanel";
import { PosePanel } from "@/components/panels/PosePanel";
import { QuantitiesPanel } from "@/components/panels/QuantitiesPanel";
import { IconButton } from "@/components/kit";
import { ProjectsDialog } from "@/components/ProjectsDialog";
import { AddSurfaceDialog } from "@/components/AddSurfaceDialog";
import { cleanRing, isSelfIntersecting, signedArea } from "@/lib/geometry";
import { normalizeOrigin } from "@/lib/edit";
import { exportJson, exportPdf, exportPng } from "@/lib/export";
import { m2, num, uid } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tab = "surface" | "tile" | "pose" | "qty";

const TABS: { id: Tab; label: string; icon: typeof Ruler }[] = [
  { id: "surface", label: "Surface", icon: Ruler },
  { id: "tile", label: "Carrelage", icon: Grid2x2 },
  { id: "pose", label: "Pose", icon: LayoutTemplate },
  { id: "qty", label: "Quantités", icon: BarChart3 },
];

export default function App() {
  const store = useProjectStore();
  const { project, update, updateSurface, undo, redo, canUndo, canRedo } = store;
  const surface = project.surfaces.find((s) => s.id === project.activeId) ?? project.surfaces[0];

  // géométrie recalculée seulement si la forme, le carreau ou la pose changent ; les couleurs à part
  const deferred = useDeferredValue(surface);
  const geomKey = JSON.stringify({ ...deferred, colors: null, name: "", margin: 0 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(() => computeLayout(deferred), [geomKey]);
  const layout = useMemo(() => recolor(geometry, deferred.colors), [geometry, deferred.colors]);

  const [tab, setTab] = useState<Tab>("surface");
  const [sheetOpen, setSheetOpen] = useState(true);
  const [tool, setTool] = useState<Tool>("select");
  const [paintColor, setPaintColor] = useState(1);
  const [selection, setSelection] = useState<Selection>({});
  const [display, setDisplay] = useState<DrawingOptions>({ showCuts: true, showCutLabels: true, showDims: true });
  const [drawCount, setDrawCount] = useState(0);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const vpRef = useRef<ViewportHandle>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // la peinture vise par défaut une couleur existante
  useEffect(() => {
    if (paintColor >= surface.colors.palette.length) setPaintColor(Math.max(0, surface.colors.palette.length - 1));
  }, [surface.colors.palette.length, paintColor]);

  useEffect(() => {
    setSelection({});
    setTool("select");
  }, [surface.id]);

  const change = useCallback(
    (fn: (s: Surface) => Surface, tag?: string) => updateSurface(surface.id, fn, tag ? { tag: `${surface.id}:${tag}` } : undefined),
    [updateSurface, surface.id]
  );

  const onViewportChange = useCallback(
    (fn: (s: Surface) => Surface, first: boolean) => updateSurface(surface.id, fn, { mode: first ? "push" : "merge" }),
    [updateSurface, surface.id]
  );

  const onDrawComplete = useCallback(
    (pts: Vec[]) => {
      let ring = cleanRing(pts);
      if (ring.length < 3 || isSelfIntersecting(ring)) {
        setToast("Contour invalide : les côtés se croisent.");
        return;
      }
      if (signedArea(ring) < 0) ring = ring.slice().reverse();
      updateSurface(surface.id, (s) => normalizeOrigin({ ...s, outline: ring }));
      setTool("select");
      setTab("surface");
      setTimeout(() => vpRef.current?.fit(), 30);
    },
    [updateSurface, surface.id]
  );

  const setActive = (id: string) => update((p) => ({ ...p, activeId: id }), { mode: "silent" });

  const addSurface = (s: Surface) => {
    update((p) => ({ ...p, surfaces: [...p.surfaces, s], activeId: s.id }));
    setTab("surface");
  };

  const duplicateSurface = () => {
    const copy: Surface = { ...structuredClone(surface), id: uid(), name: `${surface.name} (copie)` };
    addSurface(copy);
  };

  const deleteSurface = () => {
    if (project.surfaces.length <= 1) return;
    update((p) => {
      const surfaces = p.surfaces.filter((s) => s.id !== surface.id);
      return { ...p, surfaces, activeId: surfaces[0].id };
    });
  };

  const allLayouts = useMemo(
    () =>
      tab === "qty"
        ? project.surfaces.map((s) => ({ surface: s, layout: s.id === deferred.id ? layout : cachedLayout(s) }))
        : [],
    [project.surfaces, layout, deferred.id, tab]
  );

  const runExport = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      console.error(e);
      setToast("Export impossible sur ce navigateur.");
    } finally {
      setBusy(false);
    }
  };

  // raccourcis clavier
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y" && !typing) {
        e.preventDefault();
        redo();
        return;
      }
      if (typing) return;
      if (e.key === "Escape") {
        if (tool === "draw") vpRef.current?.cancelDraw();
        setTool("select");
        setSelection({});
      }
      if (e.key === "Enter" && tool === "draw") vpRef.current?.finishDraw();
      if ((e.key === "Delete" || e.key === "Backspace") && selection.opening) {
        const id = selection.opening;
        change((s) => ({ ...s, openings: s.openings.filter((o) => o.id !== id) }));
        setSelection({});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, tool, selection.opening, change]);

  const startDraw = () => {
    setTool("draw");
    setSheetOpen(false);
  };

  const selectTab = (t: Tab) => {
    const desktop = window.matchMedia("(min-width: 768px)").matches;
    if (t === tab && !desktop) setSheetOpen((o) => !o);
    else {
      setTab(t);
      setSheetOpen(true);
    }
  };

  const invalid = surface.outline.length < 3 || isSelfIntersecting(surface.outline);
  const warnings = layout.def.warnings;

  const tools: { id: Tool; label: string; icon: typeof Ruler }[] = [
    { id: "select", label: "Sélection / modifier", icon: MousePointer2 },
    { id: "move", label: "Glisser la pose", icon: Hand },
    { id: "paint", label: "Peindre les carreaux", icon: Brush },
    { id: "draw", label: "Dessiner le contour", icon: PenTool },
  ];

  const panel = (
    <>
      {tab === "surface" && (
        <SurfacePanel
          surface={surface}
          change={change}
          selection={selection}
          onSelect={setSelection}
          onDraw={startDraw}
          onFit={() => vpRef.current?.fit()}
          onDuplicate={duplicateSurface}
          onDelete={deleteSurface}
          canDelete={project.surfaces.length > 1}
        />
      )}
      {tab === "tile" && (
        <TilePanel
          surface={surface}
          change={change}
          tool={tool}
          setTool={setTool}
          paintColor={paintColor}
          setPaintColor={setPaintColor}
        />
      )}
      {tab === "pose" && (
        <PosePanel
          surface={surface}
          change={change}
          tool={tool}
          setTool={setTool}
          display={display}
          setDisplay={setDisplay}
          warnings={warnings}
        />
      )}
      {tab === "qty" && (
        <QuantitiesPanel
          project={project}
          surface={surface}
          layout={layout}
          allLayouts={allLayouts}
          change={change}
          busy={busy}
          onExportPdf={(all) =>
            runExport(() => exportPdf(project, all ? project.surfaces.map((s) => s.id) : [surface.id], display))
          }
          onExportPng={() => runExport(() => exportPng(surface, layout, display, project.name))}
          onExportJson={() => exportJson(project)}
        />
      )}
    </>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      {/* barre supérieure */}
      <header className="flex h-12 shrink-0 items-center gap-1 border-b bg-white px-2 pt-[env(safe-area-inset-top)] sm:gap-2 sm:px-3">
        <button
          type="button"
          onClick={() => setProjectsOpen(true)}
          className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted"
          title="Projets"
        >
          <span className="grid size-7 shrink-0 grid-cols-2 gap-px overflow-hidden rounded-md bg-zinc-800 p-[3px]">
            <span className="rounded-[1px] bg-amber-200" />
            <span className="rounded-[1px] bg-zinc-200" />
            <span className="rounded-[1px] bg-zinc-200" />
            <span className="rounded-[1px] bg-amber-200" />
          </span>
          <span className="hidden max-w-40 truncate text-sm font-semibold sm:inline">{project.name}</span>
          <FolderOpen className="hidden size-4 shrink-0 text-muted-foreground sm:inline md:hidden" />
        </button>
        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
        <select
          value={surface.id}
          onChange={(e) => setActive(e.target.value)}
          className="h-9 min-w-0 flex-1 rounded-md border bg-white px-2 text-base font-medium sm:max-w-64 sm:flex-none sm:text-sm"
          aria-label="Surface"
        >
          {project.surfaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.kind === "floor" ? "▦ " : "▥ "}
              {s.name}
            </option>
          ))}
        </select>
        <IconButton title="Ajouter une surface (sol ou mur)" onClick={() => setAddOpen(true)}>
          <Plus className="size-5" />
        </IconButton>
        <div className="hidden flex-1 sm:block" />
        <IconButton title="Annuler" onClick={undo} disabled={!canUndo}>
          <Undo2 className="size-5" />
        </IconButton>
        <IconButton title="Rétablir" onClick={redo} disabled={!canRedo}>
          <Redo2 className="size-5" />
        </IconButton>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* zone de dessin */}
        <div className="relative min-h-0 flex-1">
          <Viewport
            ref={vpRef}
            surface={surface}
            layout={layout}
            tool={tool}
            paintColor={paintColor}
            selection={selection}
            onSelect={(sel) => {
              setSelection(sel);
              if ((sel.edge !== null && sel.edge !== undefined) || sel.opening) {
                setTab("surface");
                setSheetOpen(true);
              }
            }}
            onChange={onViewportChange}
            onDrawComplete={onDrawComplete}
            onDrawPointsChange={setDrawCount}
            {...display}
          />

          {/* outils */}
          <div className="absolute left-2 top-2 flex flex-row gap-1 rounded-xl border bg-white/95 p-1 shadow-sm backdrop-blur md:flex-col">
            {tools.map((t) => (
              <IconButton
                key={t.id}
                title={t.label}
                active={tool === t.id}
                onClick={() => {
                  if (t.id === "draw") startDraw();
                  else setTool(tool === t.id && t.id !== "select" ? "select" : t.id);
                }}
              >
                <t.icon className="size-[18px]" />
              </IconButton>
            ))}
            <div className="my-1.5 w-px bg-border md:mx-1.5 md:my-0 md:h-px md:w-auto" />
            <IconButton title="Recadrer" onClick={() => vpRef.current?.fit()}>
              <Maximize className="size-[18px]" />
            </IconButton>
          </div>

          {/* palette de peinture */}
          {tool === "paint" && (
            <div className="absolute left-2 right-2 top-14 flex flex-wrap items-center gap-1.5 rounded-xl border bg-white/95 p-1.5 shadow-sm backdrop-blur md:left-16 md:right-auto md:top-2">
              {surface.colors.palette.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPaintColor(i)}
                  className={cn("size-8 rounded-md border shadow-sm", paintColor === i && "ring-2 ring-foreground ring-offset-1")}
                  style={{ background: c }}
                  title={`Couleur ${i + 1}`}
                />
              ))}
              <button
                type="button"
                onClick={() => setPaintColor(-1)}
                className={cn(
                  "h-8 rounded-md border bg-white px-2 text-xs font-medium",
                  paintColor < 0 && "ring-2 ring-foreground ring-offset-1"
                )}
              >
                Gomme
              </button>
            </div>
          )}

          {/* tracé en cours */}
          {tool === "draw" && (
            <div className="absolute inset-x-2 bottom-2 mx-auto flex max-w-md flex-wrap items-center justify-center gap-2 rounded-xl border bg-white/95 p-2 text-sm shadow-md backdrop-blur">
              <span className="px-1 text-muted-foreground">
                {drawCount === 0
                  ? "Touchez pour placer le premier angle"
                  : drawCount < 3
                    ? `${drawCount} point${drawCount > 1 ? "s" : ""} · continuez`
                    : `${drawCount} points · touchez le 1er pour fermer`}
              </span>
              <div className="flex gap-1.5">
                {drawCount > 0 && (
                  <button className="h-8 rounded-md border px-2.5 text-xs font-medium" onClick={() => vpRef.current?.undoDrawPoint()}>
                    Retirer
                  </button>
                )}
                <button
                  className="inline-flex h-8 items-center gap-1 rounded-md bg-foreground px-2.5 text-xs font-medium text-background disabled:opacity-40"
                  disabled={drawCount < 3}
                  onClick={() => vpRef.current?.finishDraw()}
                >
                  <Check className="size-3.5" /> Terminer
                </button>
                <button
                  className="inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-medium"
                  onClick={() => {
                    vpRef.current?.cancelDraw();
                    setTool("select");
                  }}
                >
                  <X className="size-3.5" /> Annuler
                </button>
              </div>
            </div>
          )}

          {/* résumé */}
          {tool !== "draw" && (
            <button
              type="button"
              onClick={() => selectTab("qty")}
              className="absolute bottom-2 right-2 rounded-lg border bg-white/95 px-2 py-1 text-left text-[11px] leading-tight shadow-sm backdrop-blur md:px-2.5 md:py-1.5 md:text-xs"
            >
              <div className="font-semibold tabular-nums">
                {m2(layout.zoneArea)} m² · {num(layout.total)} carreaux
              </div>
              <div className={cn("tabular-nums", layout.small ? "text-red-600" : "text-muted-foreground")}>
                {num(layout.cut)} coupés{layout.small ? ` · ${num(layout.small)} petites coupes` : ""}
              </div>
            </button>
          )}

          {(invalid || warnings.length > 0 || layout.truncated) && tool !== "draw" && (
            <div className="pointer-events-none absolute inset-x-2 top-14 mx-auto max-w-sm rounded-lg bg-amber-50/95 px-3 py-1.5 text-center text-xs text-amber-900 shadow-sm md:inset-x-16 md:top-2">
              {invalid
                ? "Contour invalide : corrigez les côtés."
                : layout.truncated
                  ? "Trop de carreaux : affichage limité."
                  : warnings[0]}
            </div>
          )}

          {toast && (
            <div className="absolute inset-x-0 top-14 mx-auto w-fit max-w-[90%] rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white shadow-lg">
              {toast}
            </div>
          )}
        </div>

        {/* panneau : latéral sur ordinateur, tiroir bas sur mobile */}
        <aside
          className={cn(
            "flex min-h-0 shrink-0 flex-col border-t bg-zinc-50 md:h-auto md:w-[380px] md:border-l md:border-t-0",
            sheetOpen ? "h-[44dvh]" : "h-auto"
          )}
        >
          <nav className="order-2 flex shrink-0 border-t bg-white pb-[env(safe-area-inset-bottom)] md:order-1 md:border-b md:border-t-0 md:pb-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTab(t.id)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium transition md:flex-row md:justify-center md:gap-1.5 md:py-2.5 md:text-sm",
                  tab === t.id && sheetOpen ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <t.icon className={cn("size-5 md:size-4", tab === t.id && sheetOpen && "text-blue-600")} />
                {t.label}
              </button>
            ))}
          </nav>
          <div className={cn("order-1 min-h-0 flex-1 overflow-y-auto overscroll-contain md:order-2 md:block", !sheetOpen && "hidden")}>
            {panel}
          </div>
        </aside>
      </div>

      <ProjectsDialog
        open={projectsOpen}
        onOpenChange={setProjectsOpen}
        project={project}
        projectId={store.projectId}
        onRename={(name) => update((p) => ({ ...p, name }), { tag: "pname" })}
        onLoad={(p: Project, id?: string) => {
          store.load(p, id);
          setProjectsOpen(false);
        }}
      />
      <AddSurfaceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreate={(kind: SurfaceKind, s: Surface) => {
          // reprend le carrelage de la dernière surface du même type
          const similar = [...project.surfaces].reverse().find((x) => x.kind === kind);
          const next = similar
            ? {
                ...s,
                tile: { ...similar.tile },
                pattern: { ...similar.pattern },
                colors: { ...similar.colors, paint: {} },
                layout: { ...similar.layout, offsetX: 0, offsetY: 0 },
                margin: similar.margin,
                minCut: similar.minCut,
              }
            : s;
          addSurface(next);
          setAddOpen(false);
        }}
      />
    </div>
  );
}
