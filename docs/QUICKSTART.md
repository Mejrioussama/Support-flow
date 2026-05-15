# Quick Start

## Demarrage rapide

```powershell
cd C:\Users\21655\Desktop\Support-flow
docker compose up -d --build
```

Attendre ensuite que les services deviennent `healthy`.

## Verification rapide

```powershell
Invoke-WebRequest http://localhost:8082/api/actuator/health
Invoke-WebRequest http://localhost:8091/share
Invoke-WebRequest http://localhost:8180/realms/supportflow/.well-known/openid-configuration
```

## Verification fonctionnelle optionnelle

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-alfresco-camunda-e2e.ps1
```

## Services principaux

- frontend : [http://localhost:4200](http://localhost:4200)
- backend : [http://localhost:8082/api](http://localhost:8082/api)
- swagger : [http://localhost:8082/api/swagger-ui.html](http://localhost:8082/api/swagger-ui.html)
- keycloak : [http://localhost:8180](http://localhost:8180)
- alfresco share : [http://localhost:8091/share](http://localhost:8091/share)
- mailhog : [http://localhost:8025](http://localhost:8025)

## Comptes de test

- `admin / admin123`
- `manager / manager123`
- `agent1 / agent123`
- `client1 / client123`

