# GANTT SIMPLE - SUPPORTFLOW (4 semaines)

## Hypothèse de départ
- Début: Lundi S1
- Fin: Vendredi S4

## Vue planning

| ID | Tâche | Début | Fin | Durée | Dépend de | Livrable |
|---|---|---|---|---|---|---|
| T1 | Stabilisation workflow & bugs P1/P2 | S1-J1 | S1-J3 | 3j | - | Flux ticket stable |
| T2 | Tests backend critiques | S1-J3 | S1-J4 | 2j | T1 | Tests TicketService/Controllers |
| T3 | Smoke tests frontend | S1-J4 | S1-J5 | 2j | T1 | Parcours UI validés |
| T4 | CI GitHub Actions (build/test/images) | S2-J1 | S2-J2 | 2j | T2,T3 | Pipeline CI OK |
| T5 | Manifests K8s (backend/frontend/db/ingress) | S2-J2 | S2-J3 | 2j | T4 | Dossier `manifests/` |
| T6 | ArgoCD App + auto-sync GitOps | S2-J3 | S2-J5 | 3j | T5 | Déploiement auto |
| T7 | Intégration Alfresco CMIS réelle | S3-J1 | S3-J2 | 2j | T6 | Archivage réel |
| T8 | Rapports mensuels PDF/Excel + endpoints | S3-J2 | S3-J4 | 3j | T7 | `/api/reports/monthly` |
| T9 | Recherche métadonnées + validation archivage | S3-J4 | S3-J5 | 2j | T8 | Recherche Alfresco OK |
| T10 | Migration PrimeNG écrans clés | S4-J1 | S4-J3 | 3j | T3 | UI conforme sujet |
| T11 | Activation PWA + offline shell | S4-J2 | S4-J3 | 2j | T10 | PWA installable |
| T12 | SonarQube PostgreSQL + analyse pipeline | S4-J3 | S4-J4 | 2j | T4 | Qualité code visible |
| T13 | Documentation + slides + répétition démo | S4-J4 | S4-J5 | 2j | T6,T9,T11,T12 | Pack soutenance final |

---

## Jalons

1. **Jalon M1 (fin S1)**
- Workflow stable, bugs bloquants fermés, tests de base en place.

2. **Jalon M2 (fin S2)**
- CI/CD + GitOps opérationnels (push => deploy).

3. **Jalon M3 (fin S3)**
- Alfresco réel + rapports mensuels archivés.

4. **Jalon M4 (fin S4)**
- UI PrimeNG/PWA + Sonar + documentation + soutenance prête.

---

## Suivi quotidien (checklist)

### Semaine 1
- [ ] S1-J1
- [ ] S1-J2
- [ ] S1-J3
- [ ] S1-J4
- [ ] S1-J5

### Semaine 2
- [ ] S2-J1
- [ ] S2-J2
- [ ] S2-J3
- [ ] S2-J4
- [ ] S2-J5

### Semaine 3
- [ ] S3-J1
- [ ] S3-J2
- [ ] S3-J3
- [ ] S3-J4
- [ ] S3-J5

### Semaine 4
- [ ] S4-J1
- [ ] S4-J2
- [ ] S4-J3
- [ ] S4-J4
- [ ] S4-J5

---

## Critères de succès finaux
- [ ] Workflow ticket complet démontré (tous rôles)
- [ ] Escalade SLA automatique synchronisée Camunda/UI
- [ ] Rapport mensuel PDF/Excel généré et archivé
- [ ] Déploiement auto GitOps validé
- [ ] PWA installable et fonctionnelle
- [ ] SonarQube actif Java + TypeScript
- [ ] Documentation et soutenance finalisées
