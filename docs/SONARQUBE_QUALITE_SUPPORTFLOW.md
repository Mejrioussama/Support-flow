# SonarQube - Preuve Qualite SupportFlow

## Objectif
Verifier la conformite du sujet sur l analyse qualite `Java + TypeScript` avec `PostgreSQL` dedie a SonarQube.

## Architecture
- `docker-compose.yml` expose:
  - `supportflow-sonarqube`
  - `supportflow-sonarqube-postgres`
- Le backend utilise Maven pour l analyse Java.
- Le frontend utilise `sonar-scanner` pour l analyse TypeScript.

## Configuration GitHub Actions
Le workflow ne depend plus d un serveur SonarQube externe.

Il demarre maintenant un SonarQube ephemere directement dans le job CI, puis lance :
- analyse backend `mvn clean verify sonar:sonar`
- analyse frontend `npx sonar-scanner`

Donc :
- `SONAR_HOST_URL` n est plus requis dans GitHub Secrets
- `SONAR_TOKEN` n est plus requis dans GitHub Secrets

## Verification locale
1. Lancer les outils:
   - `docker compose --profile tools up -d sonarqube-postgres sonarqube`
2. Ouvrir `http://localhost:9000`.
3. Verifier que SonarQube est connecte a PostgreSQL.
4. Lancer les builds:
   - backend `mvn clean verify`
   - frontend `npm run build`
5. Verifier la configuration CI dans `.github/workflows/ci-cd.yml`.

## Verification CI
- job `code-quality`
- analyse backend `mvn clean verify sonar:sonar`
- analyse frontend `npx sonar-scanner`

## Preuves a capturer
- page projet backend
- page projet frontend
- quality gate
- mesures principales:
  - bugs
  - vulnerabilities
  - code smells
  - couverture si disponible

## Resultat attendu
- SonarQube fonctionne sur PostgreSQL dedie.
- Les deux analyses backend/frontend passent dans GitHub Actions sans secret Sonar externe.
- Le dashboard qualite est exploitable comme preuve de conformite du projet.
