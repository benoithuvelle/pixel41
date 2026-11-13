import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Download, FolderOpen } from "lucide-react";
import { isStandalone } from "@/lib/install";
import romain from "@/assets/romain.jpg";
import { ROMAIN_FACTS } from "@/lib/romain";

// Photo portrait facultative : déposer src/assets/romain-portrait.jpg pour la mettre en avant.
const portraits = import.meta.glob("../assets/romain-portrait.{jpg,jpeg,png,webp}", {
  eager: true,
  import: "default",
}) as Record<string, string>;
const PORTRAIT = Object.values(portraits)[0] as string | undefined;

const PITCH = "et je suis convaincu qu'un intérieur bien pensé peut changer le quotidien.";

interface Props {
  onEnter: () => void;
  onOpenProjects: () => void;
  onInstall: () => void;
}

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Écran d'accueil : Romain présente le projet… puis dit la vérité. */
export function Welcome({ onEnter, onOpenProjects, onInstall }: Props) {
  const still = useMemo(reduced, []);
  // 0 : prénom · 1 : discours · 2 : rature · 3 : la vérité
  const [phase, setPhase] = useState(still ? 3 : 0);
  const [typed, setTyped] = useState(still ? PITCH.length : 0);
  const [fact, setFact] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (still) return;
    const t = setTimeout(() => setPhase(1), 700);
    return () => clearTimeout(t);
  }, [still]);

  useEffect(() => {
    if (phase !== 1) return;
    if (typed >= PITCH.length) {
      const t = setTimeout(() => setPhase(2), 650);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setTyped((n) => n + 1), PITCH[typed] === " " ? 18 : 30);
    return () => clearTimeout(t);
  }, [phase, typed]);

  useEffect(() => {
    if (phase !== 2) return;
    const t = setTimeout(() => setPhase(3), 700);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    const t = setInterval(() => setFact((f) => (f + 1) % ROMAIN_FACTS.length), 3200);
    return () => clearInterval(t);
  }, []);

  const leave = (then: () => void) => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(then, still ? 0 : 420);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") leave(onEnter);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onEnter, leaving]);

  // léger effet de profondeur à la souris
  const onMove = (e: React.PointerEvent) => {
    if (still || e.pointerType !== "mouse" || !rootRef.current) return;
    const r = rootRef.current.getBoundingClientRect();
    rootRef.current.style.setProperty("--mx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    rootRef.current.style.setProperty("--my", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  };

  return (
    <div
      ref={rootRef}
      onPointerMove={onMove}
      className="welcome fixed inset-0 z-[60] overflow-y-auto overflow-x-hidden"
      data-leaving={leaving || undefined}
      role="dialog"
      aria-label="Accueil"
    >
      <TileField />
      <div className="relative z-10 mx-auto flex min-h-full max-w-6xl flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))] md:px-12">
        <header className="flex items-center justify-between">
          <span className="w-brand">Calepinage</span>
          <span className="w-chip">par Romain</span>
        </header>

        <main className="flex flex-1 flex-col items-center gap-5 py-4 md:flex-row-reverse md:items-center md:justify-between md:gap-14 md:py-10">
          <figure className="w-photo">
            <div className="w-photo-clip">
              <img
                src={PORTRAIT ?? romain}
                alt="Romain, designer et architecte d'intérieur"
                width={960}
                height={960}
                data-portrait={PORTRAIT ? "" : undefined}
              />
            </div>
            <figcaption className="w-patch" aria-hidden="true">
              <b>Rom'</b>
              <span>Quality calepineur</span>
            </figcaption>
          </figure>

          <section className="w-copy">
            <h1 className="w-hello">Moi c'est Romain,</h1>
            <p className="w-pitch" data-struck={phase >= 2 || undefined} aria-label={PITCH}>
              <span>{PITCH.slice(0, typed)}</span>
              {phase === 1 && <i className="w-caret" aria-hidden="true" />}
            </p>
            <p className="w-truth" data-shown={phase >= 3 || undefined}>
              Le carrelage, c'est <mark>toute ma vie</mark>.
            </p>
            <p className="w-fact" aria-live="polite">
              <span key={fact}>{ROMAIN_FACTS[fact]}</span>
            </p>
            <div className="w-actions">
              <button type="button" className="w-cta" onClick={() => leave(onEnter)}>
                Commencer un calepinage <ArrowRight className="size-5" />
              </button>
              <button type="button" className="w-ghost" onClick={() => leave(onOpenProjects)}>
                <FolderOpen className="size-4" /> Mes projets
              </button>
              {!isStandalone() && (
                <button type="button" className="w-ghost" onClick={() => leave(onInstall)}>
                  <Download className="size-4" /> Installer l'app
                </button>
              )}
            </div>
          </section>
        </main>

        <footer className="w-foot">Plan coté, élévations, motifs de pose, coupes au millimètre. Romain veille.</footer>
      </div>
    </div>
  );
}

/** Fond de carreaux posés un à un, avec quelques couleurs de l'univers de Romain. */
function TileField() {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const cell = size.w < 640 ? 46 : 64;
  const cols = Math.ceil(size.w / cell) + 1;
  const rows = Math.ceil(size.h / cell) + 1;
  const tiles = useMemo(() => {
    const accents = ["var(--w-cobalt)", "var(--w-green)", "var(--w-orange)", "var(--w-red)"];
    const out: { key: number; delay: number; color?: string; pulse: number }[] = [];
    let seed = 41;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const accent = rnd() < 0.055 ? accents[Math.floor(rnd() * accents.length)] : undefined;
        out.push({ key: r * cols + c, delay: (r + c) * 28, color: accent, pulse: 2 + rnd() * 9 });
      }
    }
    return out;
  }, [rows, cols]);
  return (
    <div
      className="w-field"
      aria-hidden="true"
      style={{ gridTemplateColumns: `repeat(${cols}, ${cell}px)`, gridAutoRows: `${cell}px` }}
    >
      {tiles.map((t) => (
        <span
          key={t.key}
          style={
            {
              animationDelay: `${t.delay}ms${t.color ? `, ${t.delay + t.pulse * 1000}ms` : ""}`,
              ...(t.color ? { "--accent": t.color } : {}),
            } as React.CSSProperties
          }
          data-accent={t.color ? "" : undefined}
        />
      ))}
    </div>
  );
}
