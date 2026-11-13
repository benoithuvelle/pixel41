import { renderToStaticMarkup } from "react-dom/server";
import type { Project, Surface } from "@/types";
import { computeLayout, type LayoutResult } from "./layout";
import { Drawing } from "@/components/Drawing";
import { fitView, type DrawingOptions } from "./view";
import { alignSummary, patternSummary, quantities, tileSummary } from "./quantities";
import { cm, m2, num } from "./format";
import { colorName } from "./palettes";

/** SVG autonome : dessiné dans un repère w×h (px logiques) et rendu à `scale` fois cette taille. */
export function surfaceSvg(surface: Surface, layout: LayoutResult, w: number, h: number, opts: DrawingOptions, scale = 1): string {
  const view = fitView(surface, w, h, { top: 44, right: 44, bottom: 44, left: 44 });
  const inner = renderToStaticMarkup(
    <Drawing surface={surface} layout={layout} view={view} idPrefix={`x${surface.id}`} {...opts} />
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#ffffff"/>${inner}</svg>`;
}

export function svgToCanvas(svg: string, w: number, h: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas"));
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error("Rendu SVG impossible"));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}

interface DownloadsApi {
  save: (r: { filename: string; data: Blob }) => Promise<{ status: string }>;
}

/**
 * Hôte claude.ai (page publiée) : les téléchargements passent par la capacité « downloads ».
 * Ailleurs, `window.claude` n'existe pas et on retombe sur un lien de téléchargement classique.
 */
async function hostDownloads(): Promise<DownloadsApi | null> {
  const host = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (!host?.use) return null;
  try {
    return ((await host.use("downloads")) as DownloadsApi | null) ?? null;
  } catch {
    return null;
  }
}

/** Propose le fichier ; renvoie false si l'utilisateur a refusé. */
export async function download(blob: Blob, filename: string): Promise<boolean> {
  const api = await hostDownloads();
  if (api) {
    try {
      await api.save({ filename, data: blob });
      return true;
    } catch (e) {
      if ((e as { code?: string })?.code === "declined") return false;
      throw e;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

export const safeName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase() || "calepinage";

export async function exportPng(surface: Surface, layout: LayoutResult, opts: DrawingOptions, projectName: string) {
  const b = surface.outline;
  const xs = b.map((p) => p.x);
  const ys = b.map((p) => p.y);
  const ratio = (Math.max(...xs) - Math.min(...xs)) / Math.max(1, Math.max(...ys) - Math.min(...ys));
  const w = 1200;
  const h = Math.round(Math.min(1600, Math.max(600, w / Math.max(0.4, ratio))));
  const svg = surfaceSvg(surface, layout, w, h, opts, 2);
  const canvas = await svgToCanvas(svg, w * 2, h * 2);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (blob) await download(blob, `${safeName(projectName)}-${safeName(surface.name)}.png`);
}

export async function exportJson(project: Project) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  await download(blob, `${safeName(project.name)}.calepinage.json`);
}

/** Texte compatible avec les polices standard du PDF (Latin-1). */
const t = (s: string) =>
  s
    .replace(/[\u202f\u00a0]/g, " ")
    .replace(/[⅓]/g, "1/3")
    .replace(/[¼]/g, "1/4")
    .replace(/[’]/g, "'")
    .replace(/[→]/g, "->")
    .replace(/[—–]/g, "-")
    .replace(/€/g, "EUR")
    .replace(/[^\x20-\xff\n]/g, "");

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export async function exportPdf(project: Project, surfaceIds: string[], opts: DrawingOptions) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 10;
  const date = new Date().toLocaleDateString("fr-FR");
  const surfaces = project.surfaces.filter((s) => surfaceIds.includes(s.id));
  const all = surfaces.map((s) => ({ s, layout: computeLayout(s) }));
  let first = true;

  const header = (title: string) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.setTextColor(20);
    pdf.text(t(title), M, M + 5);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(110);
    pdf.text(t(`${project.name} · ${date}`), W - M, M + 5, { align: "right" });
    pdf.setDrawColor(220);
    pdf.line(M, M + 8, W - M, M + 8);
  };

  for (const { s, layout } of all) {
    if (!first) pdf.addPage();
    first = false;
    header(`${s.name} — ${s.kind === "floor" ? "plan de calepinage" : "élévation"}`);
    const q = quantities(s, layout);

    // dessin
    const boxW = 185;
    const boxH = H - M * 2 - 12;
    // ~1000 px logiques pour 185 mm : textes de 12 px ≈ 2,2 mm, rendu à 2,5× pour la netteté
    const pxW = 1000;
    const pxH = Math.round((pxW * boxH) / boxW);
    const svg = surfaceSvg(s, layout, pxW, pxH, opts, 2.5);
    const canvas = await svgToCanvas(svg, pxW * 2.5, pxH * 2.5);
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", M, M + 11, boxW, boxH);
    pdf.setFontSize(7);
    pdf.setTextColor(120);
    pdf.text(t("Cotes en cm. Coupes hachurées en bleu, petites coupes en rouge."), M, H - M + 3);

    // colonne d'informations
    let x = M + boxW + 6;
    let y = M + 16;
    const colW = W - M - x;
    const line = (label: string, value: string, bold = false, indent = 0) => {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(110);
      pdf.text(t(label), x + indent, y);
      pdf.setFont("helvetica", bold ? "bold" : "normal");
      pdf.setTextColor(20);
      const lines = pdf.splitTextToSize(t(value), colW * 0.58);
      pdf.text(lines, x + colW, y, { align: "right" });
      y += 4.6 * Math.max(1, lines.length);
    };
    const title = (s2: string) => {
      y += 2;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(20);
      pdf.text(t(s2), x, y);
      y += 1.5;
      pdf.setDrawColor(230);
      pdf.line(x, y, x + colW, y);
      y += 4.5;
    };

    title("Carrelage");
    line("Référence", s.tile.name || "-");
    line("Format", tileSummary(s));
    line("Pose", patternSummary(s));
    line("Calage", alignSummary(s));
    title("Quantités");
    line("Surface carrelée", `${m2(layout.zoneArea)} m²`, true);
    line("Carreaux entiers", num(q.full));
    line("Carreaux coupés", num(q.cut));
    if (q.small) line("dont petites coupes", num(q.small));
    line("Total posé", num(q.total), true);
    line("Marge de chutes", `${num(s.margin)} %`);
    if (q.formats.length > 1) {
      for (const f of q.formats) line(`  ${f.label}`, `${num(f.order)} u (posés ${num(f.laid)})`);
    }
    line("À commander", `${num(q.orderTiles)} carreaux`, true);
    line("Soit", `${num(q.orderM2, 2)} m²`);
    if (q.boxes !== null) line("Cartons", `${num(q.boxes)} × ${num(s.tile.perBox)}`, true);
    if (q.cost !== null) line("Budget carrelage", `${num(q.cost, 0)} EUR`, true);
    if (q.groutKg > 0) line("Mortier joint (estim.)", `${num(q.groutKg, 1)} kg`);
    if (q.colors.length > 1) {
      title("Couleurs");
      for (const c of q.colors) {
        pdf.setFillColor(...hexRgb(c.color));
        pdf.setDrawColor(180);
        pdf.rect(x, y - 2.8, 3.2, 3.2, "FD");
        line(colorName(c.color), `${num(c.order)} (posés ${num(c.laid)})`, false, 5);
      }
    }

    // liste des coupes (page suivante si nécessaire)
    if (layout.cutGroups.length) {
      const rows = layout.cutGroups;
      const fits = y + 14 + rows.length * 4.4 < H - M;
      if (!fits) {
        pdf.addPage();
        header(`${s.name} — liste des coupes`);
        x = M;
        y = M + 18;
      } else {
        title("Coupes");
      }
      const colX = fits ? [x] : [M, M + 70, M + 140, M + 210];
      let col = 0;
      const top = y;
      for (const g of rows) {
        if (y > H - M - 2) {
          col++;
          if (col >= colX.length) break;
          y = top;
        }
        const cx = colX[col];
        pdf.setFont("helvetica", g.small ? "bold" : "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(g.small ? 180 : 20, g.small ? 30 : 20, g.small ? 30 : 20);
        const fmt = layout.def.formats.length > 1 ? ` [${layout.def.formats[g.format].label}]` : "";
        pdf.text(t(`${cm(g.w)} × ${cm(g.h)} cm${g.rect ? "" : " (biais)"}${fmt}`), cx, y);
        pdf.text(t(`× ${g.count}`), cx + (fits ? colW : 60), y, { align: "right" });
        y += 4.4;
      }
    }
  }

  // récapitulatif projet
  if (all.length > 1) {
    pdf.addPage();
    header("Récapitulatif du projet");
    let y = M + 20;
    const cols = [M, M + 70, M + 135, M + 160, M + 185, M + 210, M + 240];
    const heads = ["Surface", "Carrelage", "m²", "Posés", "Coupés", "À commander", "Cartons"];
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    heads.forEach((h, i) => pdf.text(t(h), cols[i], y));
    y += 6;
    pdf.setFont("helvetica", "normal");
    let tm2 = 0;
    for (const { s, layout } of all) {
      const q = quantities(s, layout);
      tm2 += q.zoneM2;
      const row = [
        s.name,
        `${s.tile.name} (${tileSummary(s).split(",")[0]})`,
        m2(layout.zoneArea),
        num(q.total),
        num(q.cut),
        num(q.orderTiles),
        q.boxes !== null ? num(q.boxes) : "-",
      ];
      row.forEach((v, i) => pdf.text(pdf.splitTextToSize(t(v), (cols[i + 1] ?? W - M) - cols[i] - 3)[0], cols[i], y));
      y += 6;
    }
    pdf.setFont("helvetica", "bold");
    pdf.text(t(`Total : ${num(tm2, 2)} m²`), M, y + 4);
  }

  await download(pdf.output("blob"), `${safeName(project.name)}.pdf`);
}
