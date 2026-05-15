# Acces Camunda

Camunda est integre dans le backend Spring Boot via le context path `/api/camunda`.

## URLs de reference

- Cockpit : [http://localhost:8082/api/camunda/app/cockpit/default/](http://localhost:8082/api/camunda/app/cockpit/default/)
- Tasklist : [http://localhost:8082/api/camunda/app/tasklist/default/](http://localhost:8082/api/camunda/app/tasklist/default/)
- Admin : [http://localhost:8082/api/camunda/app/admin/default/](http://localhost:8082/api/camunda/app/admin/default/)
- REST API : [http://localhost:8082/api/camunda/engine-rest/](http://localhost:8082/api/camunda/engine-rest/)

## Verifications rapides

```powershell
Invoke-WebRequest http://localhost:8082/api/camunda/app/cockpit/default/
Invoke-WebRequest http://localhost:8082/api/camunda/engine-rest/process-definition
```

## Usage en soutenance

- ouvrir Cockpit apres creation de ticket
- verifier qu une instance de processus est visible
- montrer l evolution apres assignation, resolution ou attente client

## Point important

Ne pas utiliser les anciens ports `8080` ou `8081` pour la demo Docker actuelle.
La valeur correcte pour le backend est `8082`.

