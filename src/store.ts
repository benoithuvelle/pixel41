import { useCallback, useEffect, useRef, useState } from "react";
import type { Project, Surface } from "@/types";
import { demoProject, sanitizeProject } from "@/lib/defaults";
import { uid } from "@/lib/format";

const LIB_KEY = "calepinage:projects";
const CURRENT_KEY = "calepinage:current";

export interface SavedProject {
  id: string;
  name: string;
  updatedAt: number;
  data: Project;
}

function readLib(): SavedProject[] {
  try {
    const raw = localStorage.getItem(LIB_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((e) => ({ ...e, data: sanitizeProject(e.data) }))
      .filter((e): e is SavedProject => !!e.data && typeof e.id === "string");
  } catch {
    return [];
  }
}

function writeLib(lib: SavedProject[]) {
  try {
    localStorage.setItem(LIB_KEY, JSON.stringify(lib));
  } catch (e) {
    console.warn("Sauvegarde impossible", e);
  }
}

function initial(): { id: string; project: Project } {
  const lib = readLib();
  let currentId: string | null = null;
  try {
    currentId = localStorage.getItem(CURRENT_KEY);
  } catch {
    /* ignore */
  }
  const found = lib.find((p) => p.id === currentId) ?? lib.sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (found) return { id: found.id, project: found.data };
  return { id: uid(), project: demoProject() };
}

export type HistoryMode = "push" | "merge" | "silent";

interface State {
  id: string;
  past: Project[];
  present: Project;
  future: Project[];
}

/** Projet courant avec annuler / rétablir et sauvegarde automatique. */
export function useProjectStore() {
  const [state, setState] = useState<State>(() => {
    const init = initial();
    return { id: init.id, past: [], present: init.project, future: [] };
  });
  const lastTag = useRef<{ tag: string; at: number } | null>(null);

  // sauvegarde automatique
  useEffect(() => {
    const t = setTimeout(() => {
      const lib = readLib();
      const entry: SavedProject = {
        id: state.id,
        name: state.present.name,
        updatedAt: Date.now(),
        data: state.present,
      };
      const idx = lib.findIndex((p) => p.id === state.id);
      if (idx >= 0) lib[idx] = entry;
      else lib.push(entry);
      writeLib(lib);
      try {
        localStorage.setItem(CURRENT_KEY, state.id);
      } catch {
        /* ignore */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [state.present, state.id]);

  /**
   * Modifie le projet. `tag` permet de regrouper les saisies successives d'un même champ
   * dans une seule étape d'historique.
   */
  const update = useCallback((fn: (p: Project) => Project, opts?: { tag?: string; mode?: HistoryMode }) => {
    const now = Date.now();
    let merge = opts?.mode === "merge";
    if (!merge && opts?.tag && lastTag.current && lastTag.current.tag === opts.tag && now - lastTag.current.at < 1200) {
      merge = true;
    }
    lastTag.current = opts?.tag ? { tag: opts.tag, at: now } : null;
    setState((s) => {
      const next = fn(s.present);
      if (next === s.present) return s;
      if (opts?.mode === "silent") return { ...s, present: next };
      if (merge && s.past.length) return { ...s, present: next, future: [] };
      return { ...s, past: [...s.past.slice(-80), s.present], present: next, future: [] };
    });
  }, []);

  const updateSurface = useCallback(
    (id: string, fn: (s: Surface) => Surface, opts?: { tag?: string; mode?: HistoryMode }) => {
      update(
        (p) => ({
          ...p,
          surfaces: p.surfaces.map((s) => (s.id === id ? fn(s) : s)),
        }),
        opts
      );
    },
    [update]
  );

  const undo = useCallback(() => {
    lastTag.current = null;
    setState((s) => {
      if (!s.past.length) return s;
      const prev = s.past[s.past.length - 1];
      return { ...s, past: s.past.slice(0, -1), present: prev, future: [s.present, ...s.future] };
    });
  }, []);

  const redo = useCallback(() => {
    lastTag.current = null;
    setState((s) => {
      if (!s.future.length) return s;
      const [next, ...rest] = s.future;
      return { ...s, past: [...s.past, s.present], present: next, future: rest };
    });
  }, []);

  const load = useCallback((project: Project, id?: string) => {
    lastTag.current = null;
    setState({ id: id ?? uid(), past: [], present: project, future: [] });
  }, []);

  return {
    project: state.present,
    projectId: state.id,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    update,
    updateSurface,
    undo,
    redo,
    load,
  };
}

export function listProjects(): SavedProject[] {
  return readLib().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function deleteProject(id: string) {
  writeLib(readLib().filter((p) => p.id !== id));
}
