# Systeme d'escalade simplifie

## Objectif

Presenter un systeme d'escalade simple, intelligent et facile a expliquer:

1. `ON_TRACK`
Le ticket suit son traitement normal.

2. `AT_RISK`
Quand 75% du SLA est consomme, le systeme envoie une alerte preventive.
L'agent et le manager savent qu'une action rapide est necessaire.

3. `L1 - Reassignation intelligente`
Si le ticket depasse son SLA ou si un ticket assigne n'est pas pris en charge,
le systeme choisit automatiquement un meilleur agent selon:
- la charge de travail
- l'expertise sur la categorie
- l'historique SLA de l'agent

4. `L2 - Alerte manager`
Si le ticket reste critique, le manager est notifie.
Le ticket reste visible comme ticket escalade.

5. `L3 - Prise en charge manager`
Si la situation continue apres le delai defini, le ticket est transfere au manager.

## Pourquoi ce modele est bon pour le jury

- Il est lisible en moins d'une minute.
- Il montre une vraie intelligence metier.
- Il evite les regles trop complexes a justifier.
- Il conserve une trace claire des decisions automatiques.

## Resume en une phrase

Le systeme surveille le SLA, alerte avant le risque, reaffecte intelligemment si besoin, puis donne la main au manager si le ticket reste bloque.
