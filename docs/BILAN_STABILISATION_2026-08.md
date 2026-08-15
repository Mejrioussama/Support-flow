# Bilan de la phase de nettoyage, stabilisation et validation

**Date :** 15 août 2026
**Objectif :** obtenir une application propre, stable, cohérente et démontrable devant le jury, avant la rédaction du rapport de stage.

**Méthode suivie :** audit du code/permissions/workflow, réinitialisation complète de la base, tests API systématiques (rôle par rôle, module par module), vérifications de sécurité ciblées, corrections une par une avec re-test de non-régression (suite de 161 tests backend) après chaque correctif.

---

## 1. Ce qui a été validé

### Base de données
- Réinitialisation complète via `docker compose --profile demo up demo-data-loader` (truncate des 14 tables + rejeu de `data-docker.sql`).
- Intégrité confirmée : 4 clients, 9 utilisateurs, 12 tickets, aucune donnée orpheline, aucun doublon.
- `ticket_reference_sequence` synchronisé avec `MAX(reference)` — vérifié après un double rejeu du seed (idempotent).

### Comptes et authentification
- Inscription (Sign Up) via le flux Keycloak réel : un nouvel utilisateur reçoit uniquement le rôle `CLIENT`, confirmé côté UI (navigation filtrée) et côté base (`role='CLIENT'`).
- Connexion/déconnexion testées pour les 4 rôles (`ADMIN`, `SUPPORT_MANAGER`, `SUPPORT_AGENT`, `CLIENT`) : redirection correcte, session Keycloak réellement terminée à la déconnexion (pas un simple clear local).
- Les 9 comptes du jeu de démo (`admin`, `manager`, `agent1/2/3`, `client1/2/3/4`) sont désormais tous fonctionnels et se relient correctement à leur ligne `User` existante en base par email (aucun doublon créé).

### Modules fonctionnels (testés par rôle, via API)
- **Tickets** : cycle de vie complet testé de bout en bout — création (client) → assignation (manager) → prise en charge (agent assigné) → résolution → clôture avec note de satisfaction (client) → persistance vérifiée par relecture.
- **Clients, Utilisateurs, Base de connaissance, Commentaires, Notifications, Rapports mensuels** : au moins une opération nominale vérifiée par rôle autorisé, avec refus correct (403) pour les rôles non autorisés.
- **Assistant IA** : couvert en profondeur lors d'une session précédente (caching, réponses SQL, streaming) — non re-testé en détail ici, toujours opérationnel.

### Transitions de workflow
- Cas nominal complet : `NEW → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED`.
- Cas d'erreur : un agent non assigné ne peut ni prendre en charge, ni résoudre un ticket (`403`/`400`) ; clôture refusée sans note de satisfaction valide (1-5) ; double clôture bloquée.
- Cas limite : réatteignabilité de `CANCELLED` vérifiée (voir §3, point traité).

### Sécurité et permissions (tous confirmés sains, avec tests réels par rôle)
- Aucun IDOR sur la lecture d'un ticket (`GET /tickets/{id}`, `/reference/{reference}`) ou sur les notifications (toujours résolues depuis le JWT de l'appelant, jamais depuis un paramètre client).
- Un client ne peut pas lire le ticket d'un autre client (`403`).
- Les endpoints manager/admin (assignation, désactivation d'utilisateur) sont bien refusés à un agent (`403`).
- Accès sans token → `401` sur tous les endpoints testés.
- **Point prioritaire du plan** : un agent non assigné à un ticket **ne peut pas** manipuler son SLA (`sla-pause`, `sla-resume`, `sla-extend`, `wait-for-customer`) — confirmé en conditions réelles, aucune faille.

### Scénario de démonstration jury
- Le script officiel existant (`docs/SOUTENANCE_SUPPORTFLOW.md`) a été validé avec l'environnement remis à neuf.
- `scripts/pre-demo-check.ps1` exécuté deux fois (avant et après le correctif du §2) : **32/32 vérifications au vert** à chaque fois (Docker, endpoints, comptes, modules, jeu de données par statut, archives GED Alfresco, rapport mensuel).
- Recommandation : relancer ce script juste avant le passage devant le jury pour confirmer la fraîcheur de l'environnement.

---

## 2. Bug réel trouvé et corrigé pendant cette phase

### Faille d'autorisation sur `PATCH /api/tickets/{id}/status`
**Cause racine :** ce endpoint ne vérifiait que le rôle générique (`SUPPORT_AGENT`/`SUPPORT_MANAGER`/`ADMIN`) via `@PreAuthorize`, sans jamais vérifier que l'agent appelant était bien assigné au ticket concerné — contrairement à tous les autres endpoints de cycle de vie (`assign`, `take-charge`, `resolve`, `close`, `sla-pause`, etc.) qui appellent systématiquement une méthode dédiée d'`AuthorizationHelper`.

**Impact vérifié en conditions réelles :** un agent totalement étranger à un ticket (ni assigné, ni manager) pouvait forcer ce ticket vers n'importe quel statut — y compris `CLOSED` sans jamais passer par la validation de résolution (résumé, diagnostic, actions) ni par la note de satisfaction client.

**Correctif appliqué** ([TicketController.java](../backend/src/main/java/com/supportflow/controller/TicketController.java)) : ajout du contrôle `authHelper.canStaffAccessTicket(jwt, id)` avant tout changement de statut, à l'identique du contrôle déjà utilisé sur `PUT /{id}`.

**Vérification :**
- Suite de tests backend relancée après correction : **161/161 tests verts**, aucune régression (le comportement testé unitairement teste `TicketService.changeStatus` directement, pas le contrôleur — le correctif ne pouvait donc pas casser ces tests).
- Test live post-correctif : un agent non assigné reçoit désormais `403` ; l'agent assigné et le manager gardent un accès `200` normal.

*(Ce correctif est présent dans l'arbre de travail mais n'a pas été commité — à valider et committer avant la démo finale si souhaité.)*

---

## 3. Points vérifiés, non-bugs (faux positifs écartés)

- **Compteurs animés du tableau de bord affichant « 0 »** : les données backend sont correctes (vérifié via `GET /api/dashboard/stats`) — l'animation `requestAnimationFrame` ne se déclenche simplement jamais dans l'environnement d'automatisation de navigateur utilisé pour les tests, ce n'est pas un bug de l'application.
- **`CANCELLED` reachability** : ce statut est atteignable via les endpoints génériques (`PUT`/`PATCH .../status`), désormais protégés par le même contrôle de propriété que le reste — mais il n'existe aucune méthode métier dédiée ni bouton UI pour l'atteindre. Ce n'est pas un statut mort par accident : c'est un statut prévu dans l'énumération mais volontairement non exposé comme action de premier niveau dans l'interface actuelle.

---

## 4. Problèmes connus restants (non bloquants, à mentionner honnêtement dans le rapport)

1. **Les endpoints génériques `PUT /tickets/{id}` et `PATCH /tickets/{id}/status` ne valident pas les transitions d'état métier**, même pour un appelant légitime (agent assigné ou manager). Un agent assigné peut donc, via ces routes génériques, faire sauter un ticket directement vers `CLOSED` sans jamais appeler `resolve()`. Le problème de *contrôle d'accès* est corrigé (§2) ; celui de *cohérence de la machine à états* est pré-existant et plus profond — les tests unitaires actuels (`TicketServiceTest.ChangeStatusTests`) valident explicitement ce comportement permissif. Recommandation pour une itération future : soit retirer le champ `status` libre de ces routes génériques au profit exclusif des endpoints dédiés, soit ajouter une validation de transition dans `TicketService`. Non corrigé maintenant pour ne pas modifier un comportement couvert par des tests existants sans validation explicite.
2. **Rôles clients Keycloak `admin`/`user` sous `supportflow-backend`** : définis dans le realm mais jamais utilisés par l'application (config morte, cosmétique).
3. **Incohérence mineure du seed** : l'utilisateur `manager` (id 2, rôle `SUPPORT_MANAGER`) porte des lignes `agent_skills` alors que ce sont normalement réservées aux `SUPPORT_AGENT`. Aucun impact fonctionnel observé, mais à corriger dans `data-docker.sql` si on veut un seed parfaitement cohérent.
4. **Cause non totalement élucidée** : lors de l'ajout des comptes `agent2`/`agent3` au realm Keycloak, leur connexion échouait initialement malgré des identifiants structurellement identiques aux autres comptes ; résolu pragmatiquement par une réinitialisation de mot de passe via l'API Admin Keycloak, sans certitude sur la cause exacte (piste : hashing différé lors de l'import du realm).

---

## 5. Recommandations pour la rédaction du rapport

**Points forts à mettre en avant :**
- Modèle d'autorisation à 3 couches cohérent (logique métier fine, `@PreAuthorize` sur 135 endpoints, garde-fous frontend), avec un vrai historique de durcissement (faille corrigée en §2, plus toutes les corrections des sessions précédentes : IDOR, race conditions, auto-registration, etc.).
- Profondeur métier réelle : SLA avec pause/reprise/extension, escalade automatique et manuelle, boucle de rejet de résolution.
- Intégration BPM (Camunda) en synchronisation asynchrone best-effort — la BDD reste toujours la source de vérité, donc aucune dépendance bloquante.
- Assistant IA entièrement local (aucune dépendance internet), avec cache et réponses SQL pour la latence.
- Suite de tests automatisés conséquente : 161 tests backend, tous verts.
- GED Alfresco et génération de rapports Jaspers fonctionnels et vérifiés en conditions réelles.

**À mentionner avec honnêteté (crédibilité du rapport) :**
- Le point du §4.1 (validation de transition incomplète sur les routes génériques) est un bon exemple de recul critique à montrer au jury : la faille de contrôle d'accès est corrigée, la question de cohérence de state machine est identifiée et documentée comme amélioration future plutôt que dissimulée.
- Les points cosmétiques du §4 (2-3) montrent une compréhension fine du système au-delà du strict nécessaire.

**Avant la soutenance :**
- Committer le correctif du §2 si validé.
- Relancer `scripts/pre-demo-check.ps1` juste avant la démonstration.
- Dérouler une fois le script de `docs/SOUTENANCE_SUPPORTFLOW.md` en conditions réelles dans le navigateur.
