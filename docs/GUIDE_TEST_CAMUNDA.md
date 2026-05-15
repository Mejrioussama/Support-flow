# Guide de test Camunda

## Objectif

Verifier que le workflow Camunda de SupportFlow est bien visible et coherent pendant la demo.

## URL de travail

- Cockpit : [http://localhost:8082/api/camunda/app/cockpit/default/](http://localhost:8082/api/camunda/app/cockpit/default/)
- Tasklist : [http://localhost:8082/api/camunda/app/tasklist/default/](http://localhost:8082/api/camunda/app/tasklist/default/)

## Scenario recommande

1. lancer `scripts/pre-demo-check.ps1`
2. se connecter au frontend
3. creer ou reutiliser un ticket de demo
4. ouvrir Camunda Cockpit
5. verifier la presence de l instance de processus
6. faire une transition metier depuis SupportFlow :
   - assignation
   - prise en charge
   - attente client
   - resolution
7. verifier que la trace workflow reste coherente

## Verification API

```powershell
Invoke-WebRequest http://localhost:8082/api/camunda/engine-rest/process-definition
Invoke-WebRequest http://localhost:8082/api/camunda/app/cockpit/default/
```

## Resultat attendu

- Cockpit accessible
- au moins une definition de processus visible
- au moins une instance liee aux tickets de demo
- aucune erreur de context path ni de port

