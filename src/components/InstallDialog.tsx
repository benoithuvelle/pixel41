import { useState, type ReactNode } from "react";
import {
  AppWindow,
  CheckCircle2,
  ChevronDown,
  Download,
  EllipsisVertical,
  Menu,
  MonitorDown,
  Share,
  SquarePlus,
  WifiOff,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { useInstall, type Platform } from "@/lib/install";
import { cn } from "@/lib/utils";

const SITE_URL: string = import.meta.env.VITE_SITE_URL || "https://pixel41.vercel.app";

const K = ({ children }: { children: ReactNode }) => (
  <span className="mx-0.5 inline-flex items-center gap-1 rounded-md border bg-white px-1.5 py-0.5 align-middle text-[12px] font-semibold text-foreground shadow-xs [&_svg]:size-3.5">
    {children}
  </span>
);

const GUIDES: Record<Platform, { title: string; device: string; steps: ReactNode[] }> = {
  ios: {
    title: "iPhone et iPad",
    device: "Safari, Chrome ou Edge",
    steps: [
      <>Ouvrez le site dans le navigateur (pas dans un aperçu intégré).</>,
      <>
        Touchez le bouton <K><Share /> Partager</K> : en bas dans Safari sur iPhone, en haut à droite sur iPad.
      </>,
      <>
        Faites défiler et choisissez <K><SquarePlus /> Sur l'écran d'accueil</K>.
      </>,
      <>
        Touchez <K>Ajouter</K>. L'icône avec la tête de Romain apparaît sur l'écran d'accueil.
      </>,
    ],
  },
  android: {
    title: "Android",
    device: "Chrome, Samsung Internet, Edge, Firefox",
    steps: [
      <>
        Touchez <K><Download /> Installer maintenant</K> ci-dessus s'il est proposé. Sinon :
      </>,
      <>
        Ouvrez le menu <K><EllipsisVertical /></K> en haut à droite (Samsung Internet : <K><Menu /></K> en bas).
      </>,
      <>
        Choisissez <K>Installer l'application</K> ou <K>Ajouter à l'écran d'accueil</K>.
      </>,
      <>
        Confirmez avec <K>Installer</K>. L'app se lance ensuite depuis son icône, en plein écran.
      </>,
    ],
  },
  "mac-safari": {
    title: "Mac avec Safari",
    device: "Safari 17 ou plus récent",
    steps: [
      <>
        Dans la barre des menus, ouvrez <K>Fichier</K> puis <K>Ajouter au Dock…</K>
      </>,
      <>
        Validez avec <K>Ajouter</K>. L'app s'ouvre ensuite depuis le Dock ou le Launchpad, dans sa propre fenêtre.
      </>,
    ],
  },
  desktop: {
    title: "Ordinateur",
    device: "Chrome, Edge, Brave ou Opera · Windows, Mac, Linux",
    steps: [
      <>
        Cliquez sur <K><Download /> Installer maintenant</K> ci-dessus, ou sur l'icône <K><MonitorDown /></K> à droite de la
        barre d'adresse.
      </>,
      <>
        Sinon, Chrome : menu <K><EllipsisVertical /></K> → <K>Caster, enregistrer et partager</K> →{" "}
        <K>Installer la page en tant qu'application</K>. Edge : menu <K>…</K> → <K>Applications</K> →{" "}
        <K>Installer ce site en tant qu'application</K>.
      </>,
      <>
        L'app s'ouvre dans sa propre fenêtre <K><AppWindow /></K> et rejoint le menu Démarrer ou le dossier Applications.
      </>,
    ],
  },
  firefox: {
    title: "Firefox",
    device: "Ordinateur",
    steps: [
      <>Firefox sur ordinateur n'installe pas les applications web.</>,
      <>Ouvrez la même adresse dans Chrome, Edge ou Safari, puis suivez les étapes correspondantes ci-dessous.</>,
      <>
        Sur Android, Firefox sait le faire : menu <K><EllipsisVertical /></K> → <K>Installer</K>.
      </>,
    ],
  },
};

const ORDER: Platform[] = ["ios", "android", "desktop", "mac-safari", "firefox"];

export function InstallDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { canPrompt, installed, embedded, platform, prompt } = useInstall();
  const [others, setOthers] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Installer l'application</DialogTitle>
          <DialogDescription>
            Une icône sur l'écran d'accueil, l'app en plein écran, et elle marche même sans réseau.
          </DialogDescription>
        </DialogHeader>

        {installed || done ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
            <div>
              <div className="font-semibold">C'est installé.</div>
              Retrouvez l'app via son icône. Vos projets restent enregistrés sur cet appareil.
            </div>
          </div>
        ) : (
          <>
            {embedded && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Vous êtes dans un aperçu intégré, où l'installation n'est pas possible. Ouvrez l'adresse du site directement
                dans votre navigateur :{" "}
                <a className="font-semibold underline" href={SITE_URL} target="_blank" rel="noreferrer">
                  {SITE_URL.replace(/^https?:\/\//, "")}
                </a>
              </p>
            )}
            {canPrompt && (
              <Button
                size="lg"
                className="h-12 w-full rounded-full text-base"
                onClick={async () => {
                  if (await prompt()) setDone(true);
                }}
              >
                <Download /> Installer maintenant
              </Button>
            )}
            <Guide platform={platform} highlight />
          </>
        )}

        <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
          <WifiOff className="mt-0.5 size-4 shrink-0" />
          Une fois ouverte une première fois, l'app fonctionne hors connexion. Les projets sont enregistrés sur l'appareil :
          pour passer de l'un à l'autre, utilisez « Fichier projet » puis « Importer ».
        </div>

        <button
          type="button"
          onClick={() => setOthers((v) => !v)}
          className="flex w-full items-center justify-between text-left text-sm font-semibold"
        >
          {installed || done ? "Installer sur un autre appareil" : "Autres appareils"}
          <ChevronDown className={cn("size-4 transition", others && "rotate-180")} />
        </button>
        {others && (
          <div className="space-y-3">
            {ORDER.filter((p) => installed || done || p !== platform).map((p) => (
              <Guide key={p} platform={p} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Guide({ platform, highlight }: { platform: Platform; highlight?: boolean }) {
  const g = GUIDES[platform];
  return (
    <section className={cn("rounded-xl border bg-white p-3.5", highlight && "border-[var(--w-cobalt)]/40 ring-2 ring-[var(--w-cobalt)]/10")}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold">{g.title}</h3>
        <span className="text-right text-[11px] text-muted-foreground">{highlight ? "Votre appareil · " : ""}{g.device}</span>
      </div>
      <ol className="space-y-2">
        {g.steps.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--w-cobalt)] text-[11px] font-bold text-white">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
