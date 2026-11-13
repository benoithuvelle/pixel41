import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Complète public/sw.js après la compilation : liste des fichiers à mettre en cache
 * pour un fonctionnement hors ligne complet, et version liée à leur contenu.
 */
function swPrecache(): Plugin {
  let files: string[] = [];
  let outDir = "dist";
  return {
    name: "sw-precache",
    apply: "build",
    configResolved(c) {
      outDir = path.resolve(c.root, c.build.outDir);
    },
    generateBundle(_, bundle) {
      files = Object.keys(bundle).filter((f) => !f.endsWith(".map") && f !== "index.html");
    },
    closeBundle() {
      const file = path.join(outDir, "sw.js");
      if (!fs.existsSync(file)) return;
      const hash = createHash("sha1").update(files.join("|")).digest("hex").slice(0, 10);
      const src = fs
        .readFileSync(file, "utf8")
        .replace('const VERSION = "calepinage-v1";', `const VERSION = "calepinage-${hash}";`)
        .replace("const CORE = [", `const CORE = [${files.map((f) => JSON.stringify("./" + f)).join(", ")}, `);
      fs.writeFileSync(file, src);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), swPrecache()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
