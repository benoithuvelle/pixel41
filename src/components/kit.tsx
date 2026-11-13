import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { parseNum } from "@/lib/format";

/**
 * Champ numérique : la valeur est stockée en mm et affichée dans l'unité choisie.
 * Accepte la virgule ; ne valide que les nombres.
 */
export function NumField({
  value,
  onChange,
  unit = "cm",
  min,
  max,
  step,
  className,
  label,
  disabled,
  digits,
}: {
  value: number;
  onChange: (mm: number) => void;
  unit?: "cm" | "mm" | "°" | "%" | "" | "€" | "u";
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  label?: ReactNode;
  disabled?: boolean;
  digits?: number;
}) {
  const factor = unit === "cm" ? 10 : 1;
  const d = digits ?? (unit === "cm" ? 2 : unit === "mm" ? 1 : 2);
  const fmt = (mm: number) => {
    const v = Math.round((mm / factor) * 10 ** d) / 10 ** d;
    return Number.isFinite(v) ? String(v).replace(".", ",") : "";
  };
  const [text, setText] = useState(fmt(value));
  const focused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (!focused.current) setText(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, unit]);

  const commit = (t: string) => {
    const n = parseNum(t);
    if (n === null) return;
    let mm = n * factor;
    if (min !== undefined) mm = Math.max(min, mm);
    if (max !== undefined) mm = Math.min(max, mm);
    if (mm !== value) onChange(mm);
  };

  const input = (
    <div className={cn("relative flex items-center", className)}>
      <input
        type="text"
        inputMode="decimal"
        enterKeyHint="done"
        disabled={disabled}
        value={text}
        onFocus={(e) => {
          focused.current = true;
          e.currentTarget.select();
        }}
        onBlur={() => {
          focused.current = false;
          if (timer.current) clearTimeout(timer.current);
          const n = parseNum(text);
          if (n === null) setText(fmt(value));
          else {
            commit(text);
            setText(fmt(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n * factor))));
          }
        }}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          if (timer.current) clearTimeout(timer.current);
          // validation différée : évite les états intermédiaires (« 1 » avant « 120 »)
          timer.current = setTimeout(() => {
            const n = parseNum(t);
            if (n !== null && (min === undefined || n * factor >= min)) commit(t);
          }, 450);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const n = parseNum(text) ?? 0;
            const st = step ?? (unit === "cm" ? 1 : unit === "mm" ? 0.5 : 1);
            const next = Math.round((n + (e.key === "ArrowUp" ? st : -st)) * 1000) / 1000;
            setText(String(next).replace(".", ","));
            commit(String(next));
          }
        }}
        className={cn(
          "h-9 w-full min-w-0 rounded-md border border-input bg-white px-2.5 text-base tabular-nums shadow-xs outline-none transition md:text-sm",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50",
          unit && "pr-9"
        )}
      />
      {unit && unit !== "u" && (
        <span className="pointer-events-none absolute right-2.5 text-xs text-muted-foreground">{unit}</span>
      )}
    </div>
  );
  if (!label) return input;
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {input}
    </label>
  );
}

export function TextField({
  value,
  onChange,
  label,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: ReactNode;
  placeholder?: string;
  className?: string;
}) {
  const input = (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-input bg-white px-2.5 text-base shadow-xs outline-none md:text-sm",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
        className
      )}
    />
  );
  if (!label) return input;
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {input}
    </label>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  className,
  size = "md",
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("flex w-full rounded-lg bg-muted p-0.5", className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 truncate rounded-md px-1.5 font-medium transition",
            size === "sm" ? "h-7 text-xs" : "h-8 text-xs sm:text-sm",
            o.value === value ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
  className,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition",
        active ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:bg-muted",
        className
      )}
    >
      {children}
    </button>
  );
}

export function Section({
  title,
  children,
  right,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-b border-border/70 px-4 py-4 last:border-b-0", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5 text-sm">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full transition",
          checked ? "bg-foreground" : "bg-zinc-300"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "left-[18px]" : "left-0.5"
          )}
        />
      </button>
    </label>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "warn" | "ok";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-2.5",
        tone === "warn" && "border-red-200 bg-red-50",
        tone === "ok" && "border-emerald-200 bg-emerald-50"
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums leading-tight">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function IconButton({
  onClick,
  children,
  title,
  active,
  disabled,
  className,
}: {
  onClick: () => void;
  children: ReactNode;
  title: string;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-md transition disabled:opacity-35",
        active ? "bg-foreground text-background" : "hover:bg-muted",
        className
      )}
    >
      {children}
    </button>
  );
}

/** Bouton à double appui : le premier arme la confirmation, le second exécute. */
export function ConfirmButton({
  onConfirm,
  title,
  children,
  disabled,
  className,
}: {
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      title={armed ? "Appuyez encore pour confirmer" : title}
      aria-label={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium transition disabled:opacity-30 [&_svg]:size-4",
        armed ? "bg-red-600 text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className
      )}
    >
      {children}
      {armed && <span>Confirmer</span>}
    </button>
  );
}
