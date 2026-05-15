# SupportFlow

SupportFlow est une plateforme de gestion de tickets support avec :

- backend `Spring Boot 3 / Java 17`
- frontend `Angular`
- authentification `Keycloak`
- workflow `Camunda`
- GED `Alfresco`
- reporting `JasperReports`
- deploiement `Docker`, `GitHub Actions`, `ArgoCD`, `Kubernetes`

## Demarrage rapide

- prerequis : `Docker Desktop`, `Java 17+`, `Node.js 20+`
- lancer l'application :
  - `docker compose up -d --build`
- frontend :
  - [http://localhost:4200](http://localhost:4200)
- backend :
  - [http://localhost:8082/api](http://localhost:8082/api)
- Keycloak :
  - [http://localhost:8180](http://localhost:8180)
- Alfresco Share :
  - [http://localhost:8091/share](http://localhost:8091/share)
- MailHog :
  - [http://localhost:8025](http://localhost:8025)
- verification soutenance :
  - `powershell -ExecutionPolicy Bypass -File .\scripts\pre-demo-check.ps1`

## Documentation utile

- index documentation : [docs/README.md](docs/README.md)
- demarrage rapide : [docs/QUICKSTART.md](docs/QUICKSTART.md)
- urls et acces : [docs/URLS_ACCES.md](docs/URLS_ACCES.md)
- troubleshooting Docker : [docs/DOCKER_TROUBLESHOOTING.md](docs/DOCKER_TROUBLESHOOTING.md)
- configuration Java : [docs/JAVA_HOME_SETUP.md](docs/JAVA_HOME_SETUP.md)
- guide utilisateur : [docs/GUIDE_UTILISATEUR_SUPPORTFLOW.md](docs/GUIDE_UTILISATEUR_SUPPORTFLOW.md)
- guide DevOps/GitOps : [docs/DEVOPS_GITOPS_SUPPORTFLOW.md](docs/DEVOPS_GITOPS_SUPPORTFLOW.md)
- execution distante GitHub/ArgoCD : [docs/REMOTE_EXECUTION_GITHUB_ARGOCD.md](docs/REMOTE_EXECUTION_GITHUB_ARGOCD.md)
- validation GitOps distante : `powershell -ExecutionPolicy Bypass -File .\scripts\validate-remote-gitops.ps1`
- validation PWA : [docs/PWA_VALIDATION_SUPPORTFLOW.md](docs/PWA_VALIDATION_SUPPORTFLOW.md)
- qualite SonarQube : [docs/SONARQUBE_QUALITE_SUPPORTFLOW.md](docs/SONARQUBE_QUALITE_SUPPORTFLOW.md)
- support soutenance : [docs/SOUTENANCE_SUPPORTFLOW.md](docs/SOUTENANCE_SUPPORTFLOW.md)
- rapport fonctionnel : [docs/RAPPORT_FONCTIONNEL.md](docs/RAPPORT_FONCTIONNEL.md)

## Comptes de test

- `admin / admin123`
- `manager / manager123`
- `agent1 / agent123`
- `client1 / client123`

## Structure du depot

- `backend/` : API Spring Boot
- `frontend/` : application Angular
- `keycloak/` : realm et theme
- `alfresco/` : configuration GED
- `k8s/` : manifests Kubernetes
- `argocd/` : applications ArgoCD
- `postman/` : collections Postman
- `scripts/` : scripts de demonstration, verification et exploitation
- `docs/` : documentation finale et guides d'exploitation

## Notes

- La racine du depot est volontairement minimaliste.
- La documentation de reference se trouve dans `docs/`.
