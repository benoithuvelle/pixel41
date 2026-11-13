import { useEffect, useRef, useState } from "react";
import { FilePlus2, Sparkles, Trash2, Upload } from "lucide-react";
import type { Project } from "@/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { TextField } from "./kit";
import { deleteProject, listProjects, type SavedProject } from "@/store";
import { demoProject, emptyProject, sanitizeProject } from "@/lib/defaults";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project: Project;
  projectId: string;
  onRename: (name: string) => void;
  onLoad: (p: Project, id?: string) => void;
}

export function ProjectsDialog({ open, onOpenChange, project, projectId, onRename, onLoad }: Props) {
  const [list, setList] = useState<SavedProject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // laisse le temps à la sauvegarde automatique
      const t = setTimeout(() => setList(listProjects()), 350);
      setError(null);
      return () => clearTimeout(t);
    }
  }, [open]);

  const importFile = async (file: File) => {
    try {
      const data = sanitizeProject(JSON.parse(await file.text()));
      if (!data) throw new Error("format");
      onLoad(data);
    } catch {
      setError("Fichier non reconnu (attendu : fichier projet .json exporté par l'application).");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Projets</DialogTitle>
          <DialogDescription>Les projets sont enregistrés automatiquement sur cet appareil.</DialogDescription>
        </DialogHeader>
        <TextField label="Nom du projet en cours" value={project.name} onChange={onRename} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button variant="outline" onClick={() => onLoad(emptyProject())}>
            <FilePlus2 /> Nouveau
          </Button>
          <Button variant="outline" onClick={() => onLoad(demoProject())}>
            <Sparkles /> Exemple
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload /> Importer
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importFile(f);
              e.target.value = "";
            }}
          />
        </div>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="space-y-1.5">
          {list.map((p) => (
            <div
              key={p.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border bg-white p-2",
                p.id === projectId && "border-foreground/40 bg-muted/50"
              )}
            >
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onLoad(p.data, p.id)}>
                <div className="truncate text-sm font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.data.surfaces.length} surface{p.data.surfaces.length > 1 ? "s" : ""} ·{" "}
                  {new Date(p.updatedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  {p.id === projectId ? " · ouvert" : ""}
                </div>
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Supprimer"
                disabled={p.id === projectId}
                onClick={() => {
                  if (!confirm(`Supprimer le projet « ${p.name} » ?`)) return;
                  deleteProject(p.id);
                  setList(listProjects());
                }}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
