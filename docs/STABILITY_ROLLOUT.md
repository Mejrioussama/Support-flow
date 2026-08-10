# Stability rollout

## Before deployment

1. Back up the MySQL `supportflow_db` database and verify that the backup can be restored.
2. Record the current ticket count and a small set of ticket references for post-deployment comparison.
3. Deploy to staging first with the same image and migration files intended for production.

Flyway runs before JPA validation. A database that already contains the SupportFlow schema is baselined at version 1; Flyway then applies the additive V2 migration. An empty database executes both V1 and V2. Neither migration deletes application data.

Demo data is not loaded during normal startup. For Docker Compose it remains an explicit operation through the `demo` profile.

## Staging validation

- Check `/api/actuator/health/readiness` and `/api/actuator/health/integrations`.
- Confirm `flyway_schema_history` contains version 1 (baseline or migration) and version 2.
- Confirm existing ticket counts and references are unchanged.
- Check `workflow_sync_jobs` for pending or failed work and review the workflow metrics.
- Exercise create, assign/take-charge, resolve, reject, close, and archive flows while briefly stopping Camunda/Alfresco dependencies to confirm recovery.
- Verify that `/api/auth/*` is unavailable outside the `dev` profile.

## Production and rollback

Use the same additive migration in production after a fresh backup. If application rollback is needed, deploy the previous application image and retain the migrated schema: V2 only adds `workflow_sync_jobs`, constraints, and indexes, so it is backward compatible. Do not remove the Flyway history table or the workflow queue during rollback.
