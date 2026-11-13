# Calepinage par Romain

Application web (mobile et ordinateur) pour préparer la pose d'un carrelage : dessin coté de la surface, choix du format et du motif de pose, calepinage précis avec la cote de chaque coupe, et quantités à commander.

## Fonctions

- **Surfaces** : sols en vue en plan et murs en élévation (vue de face). Un projet peut regrouper plusieurs surfaces.
  - Modèles (rectangle, en L, mur droit, sous rampant, pignon) ou tracé libre au doigt/à la souris, avec aimantation sur la grille et à 45°/90°.
  - Saisie au centimètre de chaque côté (les angles droits sont conservés) ou des coordonnées des points.
  - Portes, fenêtres, meubles, baignoire… exclus du calepinage ; hauteur carrelée partielle (soubassement, crédence).
- **Carreau** : formats courants en un clic ou format libre, joint (mm), épaisseur, couleur de joint, conditionnement et prix au m².
- **Motifs de pose** : droit, décalé (½, ⅓, ¼ ou libre, en rangées ou en colonnes), bâtons rompus, chevron (30–60°), vannerie, hexagone, moulinet (cabochon), opus romain 4 formats. Orientation libre (diagonale à 45°, etc.).
- **Calepinage** : point de départ (bord, centré, joint centré) dans les deux sens, décalage fin ou glissé à la main, et **optimisation automatique** qui évite les petites coupes. Coupes hachurées, petites coupes en rouge, cote de chaque coupe affichée sur le plan.
- **Couleurs** : uni, damier, rangées, colonnes, mélange aléatoire pondéré, et peinture carreau par carreau (frises, pixel art). Nuanciers « Classiques » et « Pixel 41zero42 ».
- **Quantités** : carreaux entiers/coupés, surface, marge de chutes, cartons, budget, mortier de joint, répartition par couleur et par format, liste des coupes, récapitulatif du projet.
- **Export** : PDF (plan + quantités + liste des coupes, une page par surface et un récapitulatif), image PNG, fichier projet `.json` (import/export). Enregistrement automatique sur l'appareil, annuler/rétablir.

## Installer l'application

L'app est une application web installable (PWA) qui fonctionne hors ligne une fois ouverte. Depuis l'adresse publique (https://pixel41.vercel.app) :

- **iPhone / iPad** : bouton Partager → « Sur l'écran d'accueil » → Ajouter.
- **Android** : bouton « Installer l'app » dans l'application, ou menu ⋮ → « Installer l'application ».
- **Ordinateur (Chrome, Edge)** : icône d'installation dans la barre d'adresse, ou bouton « Installer l'app ».
- **Mac avec Safari** : Fichier → « Ajouter au Dock ».

Le guide détaillé, adapté à l'appareil, est dans l'application (bouton de téléchargement en haut, accueil ou menu Projets).

## Utilisation

```bash
npm install
npm run dev      # développement
npm run build    # version de production dans dist/
npm test         # tests du moteur de calepinage
npm run build:single  # application complète en un seul fichier HTML (dist-single/)
```

Gestes : glisser pour se déplacer, pincer ou molette pour zoomer, toucher un côté pour le sélectionner, glisser un point ou une ouverture pour la déplacer. Raccourcis : Ctrl+Z / Ctrl+Maj+Z, Suppr (ouverture sélectionnée), Échap, Entrée (terminer un tracé).

## Organisation du code

- `src/lib/patterns.ts` : motifs de pose (réseau + motif élémentaire), générés sans trou ni chevauchement (vérifié par les tests).
- `src/lib/layout.ts` : zone carrelable (contour ∩ bande − ouvertures), découpe des carreaux, statistiques, optimiseur.
- `src/components/Drawing.tsx` : rendu SVG (plan, cotes, coupes), réutilisé pour l'export.
- `src/components/Viewport.tsx` : interactions (zoom, pincement, édition, peinture, tracé).
- `src/components/panels/` : panneaux Surface, Carrelage, Pose, Quantités.
