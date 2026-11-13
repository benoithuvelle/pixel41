import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import avatar from "@/assets/romain-avatar.jpg";
import type { Surface } from "@/types";
import type { LayoutResult } from "@/lib/layout";
import { ROMAIN_BACK, ROMAIN_BYE, ROMAIN_EARLY, ROMAIN_INTRO, nextLine } from "@/lib/romain";
import { cn } from "@/lib/utils";
import { isEmbedded, isStandalone } from "@/lib/install";

const MUTE_KEY = "calepinage:rom-silence-jusqua";
const EVERY = 60_000;
const PAUSE = 5 * 60_000;
const SHOW_FOR = 13_000;
const INSTALL_LINE = "Tu sais que tu peux m'installer sur ton téléphone ? Comme ça, je suis toujours dans ta poche.";

function readMute(): number {
  try {
    return Number(localStorage.getItem(MUTE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeMute(v: number) {
  try {
    if (v) localStorage.setItem(MUTE_KEY, String(v));
    else localStorage.removeItem(MUTE_KEY);
  } catch {
    /* stockage indisponible : la pause dure le temps de la session */
  }
}

interface Props {
  surface: Surface;
  layout: LayoutResult;
  tool: string;
  onInstall: () => void;
}

/** Romain, en bas à gauche du plan, qui parle toutes les minutes. */
export function RomainChat({ surface, layout, tool, onInstall }: Props) {
  const [line, setLine] = useState<{ text: string; id: number; bye?: boolean; install?: boolean } | null>(null);
  const askedInstall = useRef(false);
  const [muteUntil, setMuteUntil] = useState(readMute);
  const [now, setNow] = useState(Date.now());
  const ctx = useRef({ surface, layout, tool });
  ctx.current = { surface, layout, tool };
  const recent = useRef<string[]>([]);
  const muteRef = useRef(muteUntil);
  muteRef.current = muteUntil;
  const counter = useRef(0);

  const say = useCallback((text?: string, bye = false) => {
    // une fois par session, Rom propose de s'installer sur l'appareil
    if (!text && counter.current >= 1 && !askedInstall.current && !isStandalone() && !isEmbedded()) {
      askedInstall.current = true;
      setLine({ text: INSTALL_LINE, id: ++counter.current, install: true });
      return;
    }
    const t = text ?? nextLine(ctx.current, recent.current);
    recent.current = [...recent.current.slice(-8), t];
    setLine({ text: t, id: ++counter.current, bye });
  }, []);

  // présentation peu après l'arrivée, puis une réplique par minute
  useEffect(() => {
    const first = setTimeout(() => {
      if (Date.now() >= muteRef.current) say(ROMAIN_INTRO);
    }, 4500);
    const every = setInterval(() => {
      if (Date.now() >= muteRef.current && !document.hidden) say();
    }, EVERY);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, [say]);

  // retour après la pause de 5 minutes
  useEffect(() => {
    const left = muteUntil - Date.now();
    if (left <= 0) return;
    const t = setTimeout(() => {
      setMuteUntil(0);
      writeMute(0);
      say(ROMAIN_BACK);
    }, left);
    return () => clearTimeout(t);
  }, [muteUntil, say]);

  // décompte affiché pendant la pause
  useEffect(() => {
    if (muteUntil <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [muteUntil]);

  // la bulle disparaît seule
  useEffect(() => {
    if (!line) return;
    const t = setTimeout(() => setLine(null), line.bye ? 3500 : SHOW_FOR);
    return () => clearTimeout(t);
  }, [line]);

  const muted = muteUntil > now;
  const minutesLeft = Math.max(1, Math.ceil((muteUntil - now) / 60_000));

  const silence = () => {
    const until = Date.now() + PAUSE;
    setMuteUntil(until);
    setNow(Date.now());
    writeMute(until);
    say(ROMAIN_BYE, true);
  };

  const poke = () => {
    if (muteRef.current > Date.now()) {
      setMuteUntil(0);
      writeMute(0);
      say(ROMAIN_EARLY);
    } else say();
  };

  return (
    <div className="pointer-events-none absolute bottom-2 left-2 z-10 flex flex-col items-start gap-2">
      {line && (
        <div
          key={`bulle-${line.id}`}
          role="status"
          className="rom-bubble pointer-events-auto relative w-[min(300px,calc(100vw-96px))] rounded-2xl rounded-bl-md border border-zinc-200 bg-white p-3 pr-8 text-[14px] leading-snug text-zinc-900 shadow-lg"
        >
          <div className="mb-1 text-[11px] font-bold tracking-wide text-[var(--w-cobalt)]">Rom</div>
          <p className="font-semibold">{line.text}</p>
          {line.install && (
            <button
              type="button"
              onClick={() => {
                setLine(null);
                onInstall();
              }}
              className="mt-2.5 w-full rounded-full bg-[var(--w-cobalt)] px-3 py-1.5 text-[12px] font-bold text-white transition hover:opacity-90"
            >
              Installer l'app
            </button>
          )}
          {!line.bye && (
            <button
              type="button"
              onClick={silence}
              className="mt-2.5 w-full rounded-full bg-zinc-900 px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-[var(--w-cobalt)]"
            >
              Stp Rom, lâche-moi pendant au moins 5 min
            </button>
          )}
          <button
            type="button"
            onClick={() => setLine(null)}
            aria-label="Fermer la bulle"
            className="absolute right-1.5 top-1.5 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="size-4" />
          </button>
          <span className="absolute -bottom-[7px] left-4 size-3.5 rotate-45 border-b border-r border-zinc-200 bg-white" />
        </div>
      )}
      <button
        key={`avatar-${line?.id ?? 0}`}
        type="button"
        onClick={poke}
        title={muted ? `Rom fait une pause (encore ${minutesLeft} min). Touchez pour le réveiller.` : "Rom a quelque chose à dire"}
        aria-label={muted ? "Réveiller Rom" : "Faire parler Rom"}
        className={cn(
          "pointer-events-auto relative size-12 rounded-full border-[3px] border-white shadow-md transition hover:scale-105",
          line && !line.bye && "rom-avatar"
        )}
      >
        <img
          src={avatar}
          alt=""
          className={cn("size-full rounded-full object-cover", muted && "grayscale opacity-70")}
        />
        {muted && (
          <span className="absolute -right-1.5 -top-1.5 rounded-full bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {minutesLeft}′
          </span>
        )}
      </button>
    </div>
  );
}
