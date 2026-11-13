/** Affiche une longueur (mm) en cm, avec virgule décimale. */
export function cm(mm: number, digits = 1): string {
  if (!Number.isFinite(mm)) return "–";
  const v = Math.round((mm / 10) * 10 ** digits) / 10 ** digits;
  return v.toLocaleString("fr-FR", { maximumFractionDigits: digits });
}

/** Longueur lisible : "3,15 m" au-delà d'1 m, sinon "85 cm". */
export function lengthLabel(mm: number): string {
  if (Math.abs(mm) >= 1000) {
    return `${(Math.round(mm / 10) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
  }
  return `${cm(mm)} cm`;
}

export function m2(mm2: number, digits = 2): string {
  return (mm2 / 1e6).toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function num(n: number, digits = 0): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function money(n: number): string {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

export function parseNum(s: string): number | null {
  const t = s.replace(/\s/g, "").replace(",", ".");
  if (t === "" || t === "-" || t === ".") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export const plural = (n: number, one: string, many: string) => (Math.abs(n) >= 2 ? many : one);
