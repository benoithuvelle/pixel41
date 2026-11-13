import path from "path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Build « fichier unique » : tout le JS et le CSS sont intégrés dans dist-single/index.html,
 * utilisable hors ligne ou publié tel quel.
 */
function inlineAll(): Plugin {
  return {
    name: "inline-all",
    enforce: "post",
    generateBundle(_, bundle) {
      const html = Object.values(bundle).find((f) => f.type === "asset" && f.fileName.endsWith(".html"));
      if (!html || html.type !== "asset") return;
      let src = String(html.source);
      for (const [name, file] of Object.entries(bundle)) {
        if (file.type === "chunk" && file.isEntry) {
          // import() intégré : le marqueur de préchargement de Vite n'est plus remplacé
          const code = file.code.replace(/__VITE_PRELOAD__/g, "void 0").replace(/<\/script/gi, "<\\/script");
          src = src.replace(new RegExp(`<script[^>]*src="[^"]*${file.fileName}"[^>]*></script>`), () => `<script type="module">${code}</script>`);
          delete bundle[name];
        } else if (file.type === "asset" && file.fileName.endsWith(".css")) {
          const css = String(file.source).replace(/<\/style/gi, "<\\/style");
          src = src.replace(new RegExp(`<link[^>]*href="[^"]*${file.fileName}"[^>]*>`), () => `<style>${css}</style>`);
          delete bundle[name];
        }
      }
      src = src.replace(/<link rel="(icon|manifest)"[^>]*>\s*/g, "");
      html.source = src;
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), inlineAll()],
  base: "./",
  publicDir: false,
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: {
    outDir: "dist-single",
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
