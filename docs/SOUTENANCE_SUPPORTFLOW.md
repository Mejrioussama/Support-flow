# Soutenance SupportFlow

## Script officiel de demonstration

Avant toute demo, executer :

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\pre-demo-check.ps1
```

La soutenance ne doit commencer que si le script retourne `PRE-DEMO CHECK: OK`.

Si les tickets de demonstration ne sont plus dans les etats attendus, reseeder avant de recommencer :

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\reset-demo-data.ps1
```

## Parcours officiel a montrer

1. connexion `client1 / client123`
2. creation d un ticket avec suggestion KB avant envoi
3. connexion `manager / manager123`
4. assignation du ticket a un agent
5. consultation dashboard / supervision SLA
6. connexion `agent1 / agent123`
7. prise en charge, commentaire, attente client, reprise, resolution structuree
8. retour `client1`
9. validation ou refus de resolution
10. retour `manager`
11. ouverture Alfresco Share, consultation Camunda et rapport mensuel

## URLs exactes de demo

- frontend : [http://localhost:4200](http://localhost:4200)
- backend : [http://localhost:8082/api](http://localhost:8082/api)
- swagger : [http://localhost:8082/api/swagger-ui.html](http://localhost:8082/api/swagger-ui.html)
- keycloak : [http://localhost:8180](http://localhost:8180)
- alfresco share : [http://localhost:8091/share](http://localhost:8091/share)
- camunda cockpit : [http://localhost:8082/api/camunda/app/cockpit/default/](http://localhost:8082/api/camunda/app/cockpit/default/)
- mailhog : [http://localhost:8025](http://localhost:8025)

## Comptes de demo

- `client1 / client123`
- `agent1 / agent123`
- `manager / manager123`
- `admin / admin123`

## Points forts a montrer

- suggestions KB avant creation ticket
- parcours client / agent / manager complet
- SLA metier et supervision manager
- notifications et actions rapides
- archivage GED via Alfresco
- workflow Camunda visible dans Cockpit
- rapport mensuel Jasper
- pipeline GitOps documente

## Slides recommandees

1. contexte et probleme
2. architecture globale
3. stack technique
4. workflow Camunda
5. securite Keycloak
6. SLA et supervision manager
7. GED Alfresco et rapports Jasper
8. CI/CD GitOps et SonarQube
9. demonstration fonctionnelle
10. resultats et perspectives
