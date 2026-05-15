# PLAN D'EXECUTION FINAL - SUPPORTFLOW (4 semaines)

## Objectif
Atteindre 100% de conformité au sujet de stage avec un plan exécutable, mesurable, et démontrable devant jury.

## Priorités (ordre strict)
1. Stabiliser le cÃÂur métier (workflow, SLA, rôles, CRUD).
2. Déployer CI/CD + GitOps (GitHub Actions + ArgoCD + MicroK8s).
3. Finaliser conformité métier (Alfresco réel + rapports mensuels).
4. Finaliser conformité académique (PrimeNG/PWA, SonarQube, documentation, soutenance).

---

## Semaine 1 - Stabilisation & Qualité minimale

### Objectifs
- Zéro bug bloquant sur le flux ticket.
- Couverture de test minimale sur les parcours critiques.

### Tâches
1. Vérifier parcours par rôle: CLIENT, AGENT, MANAGER, ADMIN.
2. Corriger bugs P1/P2: permissions, SLA, upload, historique, transitions Camunda.
3. Ajouter tests backend (TicketService + endpoints critiques).
4. Ajouter smoke tests frontend (ticket-detail, SLA, actions workflow).

### Livrables
- Release stable `v1.1`.
- Rapport de non-régression.

### KPI de sortie
- 0 bug P1 ouvert.
- Workflow complet fonctionnel en démo locale.

---

## Semaine 2 - CI/CD & GitOps

### Objectifs
- Push code => build/test/image => deploy auto sur MicroK8s via ArgoCD.

### Tâches
1. GitHub Actions:
   - build backend/frontend
   - tests
   - Docker build + push GHCR
   - scan Trivy
2. Créer manifests K8s:
   - backend, frontend, db, ingress, configmaps, secrets
3. Configurer ArgoCD Application + auto-sync.
4. Pipeline GitOps pour mise à jour automatique du tag image.

### Livrables
- `manifests/` complet.
- `argocd/application.yaml`.
- Pipeline CI/CD fonctionnelle.

### KPI de sortie
- Déploiement auto validé après commit.

---

## Semaine 3 - Alfresco réel & Reporting mensuel

### Objectifs
- Archivage légal réel.
- Rapport mensuel PDF/Excel généré et archivé.

### Tâches
1. Intégration CMIS Alfresco réelle:
   - dossier par ticket
   - upload documents
   - métadonnées: ticketId, client, date, statut, gravité, version
2. Implémenter reporting mensuel:
   - agrégats SLA, MTTR, top incidents
   - génération PDF + Excel
3. Exposer endpoints:
   - `GET/POST /api/reports/monthly`
   - `GET /api/reports/monthly/download`
4. Archiver rapports dans `reports/YYYY-MM`.

### Livrables
- Alfresco opérationnel sans simulation.
- Rapports mensuels disponibles et traçables.

### KPI de sortie
- Rapport généré + trouvé via métadonnées Alfresco.

---

## Semaine 4 - PrimeNG/PWA, SonarQube, Documentation & Soutenance

### Objectifs
- Alignement UI avec le sujet.
- Qualité code visible.
- Pack final soutenance prêt.

### Tâches
1. Migration écrans clés vers PrimeNG:
   - Tickets, Dashboard, Users, Clients
2. Activer PWA:
   - service worker
   - offline shell minimal
3. SonarQube + PostgreSQL:
   - analyse Java + TypeScript dans pipeline
4. Documentation finale:
   - guide utilisateur
   - guide technique
   - guide déploiement
5. Préparer script de démo + slides jury.

### Livrables
- Release finale `v2.0`.
- Dossier documentation complet.
- Démo jury répétable.

### KPI de sortie
- PWA installable.
- SonarQube OK.
- Démo complète en < 15 min.

---

## Critères d'acceptation finaux (Definition of Done)
1. Workflow complet OPEN -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> CLOSED validé.
2. Escalade SLA automatique fonctionnelle et synchronisée Camunda/UI.
3. Archivage Alfresco réel avec recherche par métadonnées.
4. Rapport mensuel PDF/Excel généré, stocké, téléchargeable.
5. CI/CD GitOps opérationnel de bout en bout.
6. SonarQube actif avec rapports Java/TypeScript.
7. Documentation utilisateur et technique livrée.

---

## Risques & mitigation
1. Migration PrimeNG trop large:
   - Mitigation: migration écran par écran, pas de big bang.
2. Instabilité infra K8s locale:
   - Mitigation: staging minimal et scripts reproductibles.
3. Intégration CMIS fragile:
   - Mitigation: tests d'intégration dédiés + fallback contrôlé.
4. Délais serrés:
   - Mitigation: bloquer les fonctionnalités non critiques avant DoD.

---

## Checklist hebdomadaire (suivi)
- [ ] S1 validée
- [ ] S2 validée
- [ ] S3 validée
- [ ] S4 validée
- [ ] DoD global validé
