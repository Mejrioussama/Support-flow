# Guide Utilisateur SupportFlow

## 1. Objectif
Ce guide formalise les parcours finaux des profils `client`, `agent`, `manager` et `admin`.
Il sert de support utilisateur pour la soutenance et pour les tests de demonstration.

## 2. Connexion et securite
- Ouvrir l application sur `http://localhost:4200`.
- Cliquer sur `Se connecter`.
- S authentifier via Keycloak avec un compte autorise.
- En cas d oubli du mot de passe, utiliser `Mot de passe oublie`.
- Le reset par email ouvre ensuite un changement de mot de passe impose au prochain login.

## 3. Parcours client
### Creation d un ticket
- Aller dans `Tickets` puis `Nouveau Ticket`.
- Renseigner le titre, la description, la categorie, l urgence et l impact.
- Consulter le bloc `Solutions recommandees avant envoi` si des articles KB similaires existent.
- Cliquer sur `Cela m aide` pour marquer la suggestion comme utile, ou `Creer quand meme le ticket`.
- Ajouter des pieces jointes si necessaire.
- Envoyer le ticket.

### Suivi dans `Mes tickets`
- Ouvrir `Mes tickets`.
- Consulter le statut explique, l action attendue et le dernier update.
- Ouvrir le detail pour suivre:
  - historique simplifie
  - communications publiques
  - documents lies
  - solution proposee en cas de ticket `RESOLVED`

### Validation de resolution
- Si la solution convient, choisir `Valider`.
- Ajouter si souhaite une note de satisfaction et un commentaire.
- Si la solution ne convient pas, choisir `Refuser` et saisir un motif obligatoire.

## 4. Parcours agent
### Poste de travail
- Ouvrir `Agent Workbench`.
- Utiliser les segments:
  - `A prendre`
  - `Mes tickets en cours`
  - `En attente client`
  - `A reprendre`
  - `Resolution refusee`

### Traitement
- Prendre en charge un ticket.
- Ajouter des commentaires publics ou internes selon le besoin.
- Si le client doit repondre, utiliser `Mettre en attente client` avec motif.
- Si le ticket revient apres reponse client, reprendre le traitement depuis le workbench.
- Pour resoudre, remplir le formulaire structure:
  - resume
  - diagnostic
  - cause racine
  - action realisee
  - recommandation

### Capitalisation
- Sur un ticket resolu ou clos, utiliser `Creer article KB`.
- Consulter aussi les `Articles lies au ticket` et les suggestions proches.

## 5. Parcours manager
### Supervision
- Ouvrir `Tableau de bord` ou `Tickets`.
- Utiliser les segments:
  - `Sans owner`
  - `En attente client`
  - `Reponse client recue`
  - `Resolution refusee`
  - `Bloques`
  - `SLA a risque`

### Actions manager
- Assigner ou reassigner un ticket.
- Demander une revue manager.
- Prolonger ou mettre en pause le SLA avec justification.
- Ouvrir `Notifications` pour traiter les alertes groupees.

## 6. Archives & rapports
- Ouvrir `Archives & Rapports`.
- Rechercher les tickets archives par:
  - client
  - collaborateur
  - date
  - gravite
- Generer un rapport mensuel PDF/Excel.
- Telecharger les exports.
- Verifier l archivage GED dans Alfresco Share.

## 7. Utilisateurs et Keycloak
- Ouvrir `Utilisateurs`.
- Filtrer par role, statut et liaison Keycloak.
- Utiliser `Migrer Keycloak` pour les comptes existants.
- Sur la fiche utilisateur:
  - modifier les informations
  - changer le mot de passe
  - envoyer un reset par mail
  - forcer le changement de mot de passe au prochain login

## 8. Profil
- Ouvrir `Mon profil`.
- Modifier les informations personnelles.
- Choisir un avatar pret a l emploi.
- Acceder au portail securite Keycloak pour mots de passe et sessions.

## 9. Base de connaissance
- Ouvrir `Base de connaissance`.
- Rechercher des articles de resolution.
- Consulter les categories.
- Reutiliser un article lors du traitement d un incident similaire.

## 10. Bonnes pratiques
- Saisir un titre ticket explicite.
- Ajouter les captures, logs et pieces utiles.
- Toujours motiver les mises en attente, pauses SLA et refus de resolution.
- Capitaliser les solutions stabilisees dans la base de connaissance.
- Eviter de fermer un ticket sans validation client ou justification manager.
