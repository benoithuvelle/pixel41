import { useMemo } from "react";
import { FileDown, FileJson, ImageDown } from "lucide-react";
import type { Project, Surface } from "@/types";
import type { LayoutResult } from "@/lib/layout";
import { quantities, tileSummary } from "@/lib/quantities";
import { Chip, NumField, Section, Stat } from "../kit";
import { Button } from "../ui/button";
import { cm, m2, money, num, plural } from "@/lib/format";
import { colorName } from "@/lib/palettes";
import { cn } from "@/lib/utils";

interface Props {
  project: Project;
  surface: Surface;
  layout: LayoutResult;
  allLayouts: { surface: Surface; layout: LayoutResult }[];
  change: (fn: (s: Surface) => Surface, tag?: string) => void;
  onExportPdf: (all: boolean) => void;
  onExportPng: () => void;
  onExportJson: () => void;
  busy: boolean;
}

export function QuantitiesPanel({ project, surface, layout, allLayouts, change, onExportPdf, onExportPng, onExportJson, busy }: Props) {
  const q = useMemo(() => quantities(surface, layout), [surface, layout]);
  const multi = layout.def.formats.length > 1;

  const projectRows = useMemo(
    () => allLayouts.map(({ surface: s, layout: l }) => ({ s, l, q: quantities(s, l) })),
    [allLayouts]
  );
  const totalM2 = projectRows.reduce((a, r) => a + r.q.zoneM2, 0);
  const totalCost = projectRows.reduce((a, r) => a + (r.q.cost ?? 0), 0);

  return (
    <div>
      <Section title="Calepinage">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Surface" value={`${m2(layout.zoneArea)} m²`} />
          <Stat label="Carreaux posés" value={num(q.total)} sub={`${num(q.full)} entiers · ${num(q.cut)} coupés`} />
          <Stat
            label="Petites coupes"
            value={num(q.small)}
            tone={q.small ? "warn" : "ok"}
            sub={q.small ? "à éviter : recalez la pose" : "aucune"}
          />
          <Stat label="Mortier joint" value={q.groutKg > 0 ? `${num(q.groutKg, 1)} kg` : "–"} sub="estimation" />
        </div>
        {layout.truncated && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Plus de 60 000 carreaux : le calcul est tronqué. Vérifiez le format saisi.
          </p>
        )}
      </Section>

      <Section title="À commander">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">Marge</span>
          {[5, 10, 15].map((m) => (
            <Chip key={m} active={surface.margin === m} onClick={() => change((s) => ({ ...s, margin: m }))}>
              {m} %
            </Chip>
          ))}
          <NumField className="w-20" unit="%" digits={0} value={surface.margin} min={0} max={100} onChange={(v) => change((s) => ({ ...s, margin: v }), "margin")} />
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Carreaux</span>
            <span className="text-xl font-semibold tabular-nums">{num(q.orderTiles)}</span>
          </div>
          {q.boxes !== null && (
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Cartons de {surface.tile.perBox}</span>
              <span className="text-lg font-semibold tabular-nums">{num(q.boxes)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Surface</span>
            <span className="font-medium tabular-nums">{num(q.orderM2, 2)} m²</span>
          </div>
          {q.cost !== null && (
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Budget</span>
              <span className="font-medium tabular-nums">{money(q.cost)}</span>
            </div>
          )}
          <div className="mt-1 text-[11px] text-muted-foreground">
            {tileSummary(surface)} · marge {num(surface.margin)} % incluse
          </div>
        </div>
        {multi && (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 font-medium">Format</th>
                <th className="py-1 text-right font-medium">Posés</th>
                <th className="py-1 text-right font-medium">À commander</th>
              </tr>
            </thead>
            <tbody>
              {q.formats.map((f) => (
                <tr key={f.format} className="border-t">
                  <td className="py-1.5">{f.label}</td>
                  <td className="py-1.5 text-right tabular-nums">{num(f.laid)}</td>
                  <td className="py-1.5 text-right font-medium tabular-nums">{num(f.order)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {q.colors.length > 1 && (
          <div className="mt-3 space-y-1">
            {q.colors.map((c) => (
              <div key={c.color} className="flex items-center gap-2 text-sm">
                <span className="size-4 rounded border" style={{ background: c.color }} />
                <span className="flex-1 truncate">{colorName(c.color)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{num(c.laid)} posés</span>
                <span className="w-14 text-right font-medium tabular-nums">{num(c.order)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={`Liste des coupes (${num(q.cut)})`}>
        {layout.cutGroups.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucune coupe.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-2.5 py-1.5 font-medium">Dimensions (cm)</th>
                  {multi && <th className="py-1.5 font-medium">Format</th>}
                  <th className="px-2.5 py-1.5 text-right font-medium">Nb</th>
                </tr>
              </thead>
              <tbody>
                {layout.cutGroups.map((g, i) => (
                  <tr key={i} className={cn("border-t", g.small && "bg-red-50 text-red-800")}>
                    <td className="px-2.5 py-1.5 tabular-nums">
                      {cm(g.w)} × {cm(g.h)}
                      {!g.rect && <span className="ml-1 text-xs text-muted-foreground">biais</span>}
                      {g.small && <span className="ml-1 text-xs font-semibold">petite</span>}
                    </td>
                    {multi && <td className="py-1.5 text-xs">{layout.def.formats[g.format].label}</td>}
                    <td className="px-2.5 py-1.5 text-right font-medium tabular-nums">{g.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Dimensions de la pièce à découper, mesurées dans le sens du carreau (encombrement pour les coupes biaises).
        </p>
      </Section>

      {projectRows.length > 1 && (
        <Section title={`Projet « ${project.name} »`}>
          <div className="space-y-1.5">
            {projectRows.map(({ s, q: rq }) => (
              <div key={s.id} className={cn("flex items-center gap-2 text-sm", s.id === surface.id && "font-semibold")}>
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{num(rq.zoneM2, 2)} m²</span>
                <span className="w-24 text-right tabular-nums">
                  {num(rq.orderTiles)} {plural(rq.orderTiles, "carreau", "carreaux")}
                </span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-2 text-sm font-semibold">
              <span>Total</span>
              <span className="tabular-nums">
                {num(totalM2, 2)} m²{totalCost > 0 ? ` · ${money(totalCost)}` : ""}
              </span>
            </div>
          </div>
        </Section>
      )}

      <Section title="Exporter">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button variant="default" disabled={busy} onClick={() => onExportPdf(false)}>
            <FileDown /> PDF de cette surface
          </Button>
          {project.surfaces.length > 1 && (
            <Button variant="outline" disabled={busy} onClick={() => onExportPdf(true)}>
              <FileDown /> PDF du projet
            </Button>
          )}
          <Button variant="outline" disabled={busy} onClick={onExportPng}>
            <ImageDown /> Image PNG
          </Button>
          <Button variant="outline" onClick={onExportJson}>
            <FileJson /> Fichier projet
          </Button>
        </div>
      </Section>
    </div>
  );
}
