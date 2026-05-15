# GitHub / ArgoCD - Branchement distant reel

## Objectif
Ce document complete la chaine GitOps pour une execution distante reelle avec:
- GitHub Actions
- GHCR
- ArgoCD
- MicroK8s
- SonarQube

## 1. Prerequis
- un depot GitHub reel
- un owner GitHub reel
- un serveur ArgoCD accessible
- un token ArgoCD valide
- une instance SonarQube accessible
- un token SonarQube valide

## 2. Remote Git
Le depot local n avait pas encore de `git remote`.
Ajouter le remote reel:

```powershell
git remote add origin https://github.com/<owner>/<repo>.git
```

Puis pousser la branche principale:

```powershell
git push -u origin main
```

## 3. Configurer les manifests ArgoCD et GHCR
Executer le script suivant avec les vraies valeurs:

```powershell
.\scripts\configure-remote-gitops.ps1 `
  -RepoUrl "https://github.com/<owner>/<repo>.git" `
  -GitHubOwner "Mejrioussama"
```

Ce script met a jour:
- `argocd/supportflow-staging.yaml`
- `argocd/supportflow-prod.yaml`
- les images `k8s/base/*`
- les images `k8s/overlays/*`

## 4. Secrets GitHub Actions a creer
Dans `Settings -> Secrets and variables -> Actions`, ajouter:
- `SONAR_TOKEN`
- `SONAR_HOST_URL`
- `ARGOCD_SERVER`
- `ARGOCD_AUTH_TOKEN`

## 5. Comportement du workflow
Le workflow `.github/workflows/ci-cd.yml` contient maintenant un job `Remote GitOps Readiness`.

Il:
- echoue clairement si un secret distant obligatoire manque
- evite les skips silencieux
- force un vrai run de SonarQube et d ArgoCD en environnement distant

## 6. Validation attendue
- un push sur `develop`:
  - build backend/frontend
  - analyse Sonar
  - push GHCR
  - update `k8s/overlays/staging`
  - sync ArgoCD `supportflow-staging`
- un push sur `main`:
  - meme chaine vers `prod`

## 7. Verification ArgoCD
Appliquer une premiere fois les applications:

```bash
kubectl apply -n argocd -f argocd/supportflow-staging.yaml
kubectl apply -n argocd -f argocd/supportflow-prod.yaml
```

Puis verifier:
- application `supportflow-staging`
- application `supportflow-prod`
- sync status
- health status

## 8. Limites actuelles
- Les secrets reels ne sont pas stockes dans ce depot.
- Le script prepare et branche la configuration, mais la saisie des vraies valeurs doit etre faite dans GitHub et ArgoCD.
- Sans remote GitHub reel, le pipeline distant ne peut pas etre execute depuis cette machine.
