import type { Surface } from "@/types";
import type { LayoutResult } from "./layout";
import { plural } from "./format";

/** Ce que Romain dit sur l'écran d'accueil, en boucle. */
export const ROMAIN_FACTS = [
  "Designer & architecte d'intérieur.",
  "Compte les joints avant de dire bonjour.",
  "Possède plus de nuanciers que de chaussettes.",
  "Ne dites jamais « on verra à la pose » devant lui.",
  "Dort sur du 60 × 60. Rectifié.",
  "A déjà calepiné son gâteau d'anniversaire.",
];

/** Banalités qui enfoncent des portes ouvertes. */
const OBVIOUS = [
  "Savais-tu que le carrelage, c'est toute ma vie ?",
  "Un carreau, c'est carré. Sauf quand il est rectangulaire. Ou hexagonal. Bref.",
  "Plus la pièce est grande, plus il faut de carreaux. On ne te le dira nulle part ailleurs.",
  "Le sol, c'est en bas. Le mur, c'est sur le côté. Le plafond, on n'en parle pas.",
  "Un carreau entier, c'est un carreau qu'on n'a pas coupé. Note-le quelque part.",
  "Quand on pose du carrelage, après, il y a du carrelage. C'est scientifique.",
  "Le joint, c'est l'espace entre deux carreaux. Sans carreaux, c'est juste du joint. Et c'est triste.",
  "Si tu marches dessus, c'est probablement un sol.",
  "Un mètre carré, c'est un mètre sur un mètre. J'ai vérifié deux fois.",
  "Le blanc, c'est clair. Le noir, c'est foncé. Le gris, c'est entre les deux. Voilà, tu sais tout.",
  "Le carrelage, c'est comme la vie : à un moment, il faut couper.",
  "Un carrelage posé au plafond, c'est un carrelage qui a mal compris.",
  "Il fait froid pieds nus sur du carrelage. Je dis ça, c'est de l'expérience.",
  "Un carreau cassé, c'est deux petits carreaux. Il faut voir le positif.",
];

/** Sous-entendus de chantier (tout est dans l'insinuation). */
const CHEEKY = [
  "Moi, une belle pose, ça me met dans tous mes états.",
  "On dit que la taille ne compte pas. Ceux qui disent ça n'ont jamais posé du 120 × 120.",
  "Avant de poser, on prépare bien le support. C'est la base. Dans tout.",
  "Un joint bien serré, il n'y a que ça de vrai.",
  "Le double encollage, c'est pour quand on veut vraiment que ça tienne.",
  "À quatre pattes toute la journée et heureux de l'être : c'est ça, la vie de carreleur.",
  "Je préfère quand c'est bien lisse. Le support. Je parle du support.",
  "Toujours se protéger : genouillères, gants, lunettes. Tu pensais à quoi ?",
  "Le secret d'une bonne pose ? Prendre son temps et bien répartir la colle.",
  "Les grands formats ne me font pas peur. Au contraire.",
  "Rien de plus excitant qu'une coupe d'équerre au millimètre. Rien.",
  "Les bâtons rompus, c'est sensuel. Il fallait que quelqu'un le dise.",
];

export const ROMAIN_INTRO = "Salut, c'est Rom. Je passerai de temps en temps pour dire des choses importantes. Ou pas.";
export const ROMAIN_BACK = "Ça fait 5 minutes. Je suis revenu. Tu m'as manqué aussi.";
export const ROMAIN_EARLY = "Tu n'as pas tenu 5 minutes. Je le savais.";
export const ROMAIN_BYE = "D'accord, je te lâche la grappe. 5 minutes, promis.";
/** …puis il revient quelques secondes plus tard. */
export const ROMAIN_CHANGE_MIND = [
  "En fait non. Je te laisse 30 secondes.",
  "J'ai réfléchi : 5 minutes, c'est long. Je te laisse 30 secondes.",
  "En fait non. 30 secondes, et c'est déjà généreux.",
];
export const ROMAIN_BACK_SHORT = "Voilà, 30 secondes. Tu vois que je sais me tenir.";

interface Context {
  surface: Surface;
  layout: LayoutResult;
  tool: string;
}

/** Remarques liées à ce que l'utilisateur est en train de faire. */
function contextual({ surface, layout, tool }: Context): string[] {
  const out: string[] = [];
  const p = surface.pattern.type;
  const t = surface.tile;
  const j = t.joint.toLocaleString("fr-FR");
  if (layout.small > 0) {
    const n = layout.small;
    out.push(
      `J'ai vu ${n} ${plural(n, "petite coupe", "petites coupes")}. Ça me coupe l'envie. Essaie « Optimiser les coupes ».`
    );
  } else if (layout.cut > 0) {
    out.push("Zéro petite coupe. Je ne sais pas quoi dire. Si : c'est beau.");
  }
  if (p === "herringbone") out.push("Bâtons rompus ? Tu me prends par les sentiments.");
  if (p === "chevron") out.push("Moi, chez le coiffeur, on me coupe à zéro. Ici, on coupe à 45°. Chacun son style.");
  if (p === "opus") out.push("Opus romain. Romain. Coïncidence ? Je ne crois pas.");
  if (p === "hexagon") out.push("Des hexagones. Six côtés. Un de plus que cinq. Pour ceux qui comptent.");
  if (p === "grid") out.push("Pose droite. Classique. Comme moi en soirée.");
  if (p === "offset") out.push("Pose décalée. Comme mes horaires.");
  if (p === "basket") out.push("La vannerie, c'est le tricot du carrelage. Mamie serait fière.");
  if (p === "pinwheel") out.push("Un grand carreau et un petit qui tourne autour. C'est un peu nous deux.");
  if (surface.layout.angle % 90 !== 0) out.push("En diagonale, il y a plus de coupes. Mais j'aime quand c'est compliqué.");
  if (t.joint >= 5) out.push(`Un joint de ${j} mm. C'est large. Je respecte.`);
  if (t.joint > 0 && t.joint <= 1.5) out.push(`Un joint de ${j} mm. Serré. Très serré. J'ai chaud.`);
  if (Math.max(t.w, t.h) >= 1200) out.push("Du très grand format. Je ne dis rien, mais je n'en pense pas moins.");
  if (surface.kind === "wall") out.push("Un mur, c'est un sol qui s'est levé du bon pied.");
  if (tool === "paint") out.push("Tu peins les carreaux un par un ? Moi aussi, je m'occupe de chacun personnellement.");
  if (layout.zoneArea > 30e6) out.push("C'est grand, chez toi. Comme mon amour pour le carrelage.");
  return out;
}

/** Choisit la prochaine réplique en évitant les répétitions récentes. */
export function nextLine(ctx: Context, recent: string[]): string {
  const ctxLines = contextual(ctx).filter((l) => !recent.includes(l));
  const pool = [...OBVIOUS, ...CHEEKY].filter((l) => !recent.includes(l));
  const useCtx = ctxLines.length > 0 && Math.random() < 0.4;
  const from = useCtx ? ctxLines : pool.length ? pool : [...OBVIOUS, ...CHEEKY];
  return from[Math.floor(Math.random() * from.length)];
}
