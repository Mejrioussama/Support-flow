# SupportFlow - Guide DevOps GitOps

## 1. Objectif
Cette documentation formalise la chaine `GitHub Actions -> GHCR -> manifests Kubernetes -> ArgoCD -> MicroK8s`
attendue par le sujet de stage.

## 2. Images conteneur
- Backend: `ghcr.io/Mejrioussama/supportflow-backend`
- Frontend: `ghcr.io/Mejrioussama/supportflow-frontend`
- Les manifests Kubernetes versionnes utilisent maintenant un bootstrap coherent:
  - `ghcr.io/Mejrioussama/supportflow-backend:staging`
  - `ghcr.io/Mejrioussama/supportflow-frontend:staging`
- Le workflow remplace automatiquement ces tags par des tags `sha-<commit>` lors d un vrai run CI.

## 3. Pipeline GitHub Actions
Le workflow `.github/workflows/ci-cd.yml` execute:
1. build backend Maven
2. build frontend Angular production
3. analyse SonarQube backend + frontend via un SonarQube ephemere lance dans le job CI
4. scan securite Trivy
5. build/push des images vers GHCR
6. mise a jour des overlays `k8s/overlays/<env>/`
7. synchronisation ArgoCD

## 4. Secrets attendus
### Secrets GitHub Actions
- `ARGOCD_SERVER`
- `ARGOCD_AUTH_TOKEN`

### Secrets cluster / runtime
- `supportflow-secrets`
- secrets base de donnees
- secrets JWT / Keycloak / Alfresco si externalises

## 5. Mapping des environnements
- branche `develop` -> overlay `staging`
- branche `main` -> overlay `prod`

## 6. Verification GitOps attendue
- un push sur `develop` build les deux applications
- les images GHCR sont poussees
- les manifests `backend-patch.yaml` et `frontend-patch.yaml` sont mis a jour
- ArgoCD synchronise l application cible
- MicroK8s deploie les nouveaux pods

## 7. Arborescence cible
- `k8s/base`: socle SupportFlow
- `k8s/overlays/staging`: surcharge develop/staging
- `k8s/overlays/prod`: surcharge main/production
- `argocd/supportflow-staging.yaml`: application ArgoCD staging
- `argocd/supportflow-prod.yaml`: application ArgoCD production

## 8. Points de preuve pour la soutenance
- capture GitHub Actions verte
- capture GHCR avec les deux images
- capture ArgoCD synchronise
- capture MicroK8s / pods en `Running`
- capture SonarQube quality gate

## 9. Remarques
- Le workflow dispose maintenant des permissions `packages: write` pour GHCR.
- Si le depot est publie sous un autre owner GitHub, le namespace GHCR s adapte automatiquement via
  `github.repository_owner`.
- Les services lourds externes comme Keycloak et Alfresco peuvent rester hors cluster pour la soutenance si
  l architecture et la preuve de connectivite sont documentees.
