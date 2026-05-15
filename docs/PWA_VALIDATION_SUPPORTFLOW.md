# Validation PWA SupportFlow

## Objectif
Prouver que l application Angular est bien livree comme `PWA` conformement au sujet de stage.

## Configuration existante
- `frontend/angular.json`: service worker active en production
- `frontend/ngsw-config.json`: strategie de cache
- `frontend/src/manifest.webmanifest`: manifeste PWA
- `frontend/src/main.ts`: enregistrement du service worker Angular

## Procedure de validation
1. Builder le frontend en mode production.
2. Servir l application sur `http://localhost:4200`.
3. Ouvrir les DevTools:
   - `Application -> Manifest`
   - `Application -> Service Workers`
4. Verifier:
   - manifeste detecte
   - nom, theme et icones charges
   - `ngsw-worker.js` enregistre
   - mode installation disponible
5. Installer l application depuis le navigateur.
6. Recharger les pages critiques:
   - login
   - my-tickets
   - agent-workbench
   - detail ticket
7. Couper temporairement le reseau pour valider le mode degrade minimal sur les assets deja caches.

## Preuves a conserver
- capture du manifeste
- capture du service worker actif
- capture du prompt ou menu d installation
- capture de l application installee

## Resultat attendu
- SupportFlow est installable comme application desktop/mobile.
- Le service worker est actif en configuration production.
- Les assets principaux restent disponibles apres installation.
- En cas d absence reseau, l application affiche au minimum un mode degrade explicite plutot qu un ecran vide.
