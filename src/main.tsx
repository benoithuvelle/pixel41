import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./App.css";
import App from "./App.tsx";
import { listenForInstall } from "./lib/install";

listenForInstall();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Hors ligne et installation : uniquement sur un vrai site (pas en local de dev, ni en fichier, ni en page intégrée)
if (import.meta.env.PROD && "serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* contexte sans service worker (page intégrée, navigation privée) : l'app fonctionne quand même */
    });
  });
}
