# Scenario Premium - 8 Elements (SupportFlow)

## Objectif
Renforcer le scenario de soutenance pour prouver:
- robustesse operationnelle,
- gouvernance SLA,
- traçabilite audit,
- continuité de service.

## Element 1 - SLA multi-niveaux
- Etats utilises: `ON_TRACK`, `AT_RISK`, `BREACHED`.
- Champs exposes API ticket: `slaState`, `slaActionRequired`, `slaRemainingTime`.
- Vue UI: badge et bloc SLA dans la page detail ticket.

## Element 2 - Anti-blocage automatique
- Job automatique detecte les tickets `ASSIGNED` non pris en charge au-dela d'un seuil.
- Action: reassignment automatique vers manager actif.
- Historique: `ASSIGNATION_AUTO_MANAGER_STUCK`.

## Element 3 - Validation metier stricte
- Cloture interdite si:
  - pas de `resolutionSummary`,
  - note satisfaction absente ou hors [1..5].
- But: qualité de cloture + preuves exploitables.

## Element 4 - Audit renforce
- Changement statut peut inclure un motif (`reason`) via `PATCH /tickets/{id}/status`.
- Historique cree: `STATUS_REASON`.
- En cas de probleme Camunda, historique cree: `CAMUNDA_SYNC_WARNING`.

## Element 5 - KPIs de pilotage
- Dashboard enrichi:
  - `escalatedManualTickets`,
  - `escalatedSlaTickets`,
  - `slaOnTrackTickets`,
  - `slaAtRiskTickets`,
  - `slaBreachedTickets`.

## Element 6 - Incident majeur (War-room)
- Mode war-room par contexte ticket (`priority=CRITICAL`, tags `WAR_ROOM`, commentaire manager).
- Usage: incidents critiques multi-equipes, priorisation maximale et suivi rapproché.

## Element 7 - Continuite si Camunda indisponible
- Les actions metier restent executees (fallback applicatif).
- Trace explicite dans historique: `CAMUNDA_SYNC_WARNING`.
- Permet audit post-incident et reprise.

## Element 8 - Cloture executive
- Cloture avec satisfaction obligatoire + resolution formelle.
- Donnees exploitables pour rapport management:
  - SLA respect/non-respect,
  - delai de resolution,
  - satisfaction client.

---

## Endpoints de demo (jury)
- `POST /api/tickets`
- `POST /api/tickets/{id}/assign/{agentId}`
- `POST /api/tickets/{id}/take-charge`
- `POST /api/tickets/{id}/escalate`
- `POST /api/tickets/{id}/escalate-sla`
- `POST /api/tickets/{id}/sla-due-date`
- `PATCH /api/tickets/{id}/status` with `{ "status": "...", "reason": "..." }`
- `POST /api/tickets/{id}/resolve`
- `POST /api/tickets/{id}/close`
- `GET /api/dashboard/stats`

## Parametres automation (application.yml)
- `supportflow.automation.interval-ms`
- `supportflow.automation.sla-warning-minutes`
- `supportflow.automation.assigned-stuck-minutes`
