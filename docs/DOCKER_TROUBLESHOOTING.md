# Docker Troubleshooting

## Conteneurs etat

```powershell
docker compose ps
docker ps
```

## Rebuild propre

```powershell
docker compose down
docker compose up -d --build
```

## Rebuild cible

```powershell
docker compose up -d --build backend frontend
```

## Logs utiles

```powershell
docker logs supportflow-backend --tail 100
docker logs supportflow-frontend --tail 100
docker logs supportflow-keycloak --tail 100
docker logs supportflow-alfresco-share --tail 100
```

## Verification E2E locale

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-alfresco-camunda-e2e.ps1
```

## Problemes courants

### Backend inaccessible

- verifier `docker compose ps`
- verifier [http://localhost:8082/api/actuator/health](http://localhost:8082/api/actuator/health)
- lire les logs `supportflow-backend`

### Keycloak ne repond pas

- verifier [http://localhost:8180](http://localhost:8180)
- verifier le conteneur `supportflow-keycloak`

### Alfresco Share ne charge pas

- utiliser [http://localhost:8091/share](http://localhost:8091/share)
- ne pas utiliser un hostname Docker interne

### Frontend non mis a jour

- faire `Ctrl+F5`
- verifier que l'image frontend a bien ete rebuild

