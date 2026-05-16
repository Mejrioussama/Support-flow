# GitHub / ArgoCD - Branchement distant reel

## Objectif
Ce document ferme la derniere etape de la chaine GitOps reelle avec :
- GitHub Actions
- GHCR
- ArgoCD
- MicroK8s
- SonarQube

Etat actuel du projet :
- `Build Backend` : OK
- `Build Frontend` : OK
- `Security Scan` : OK
- `Remote GitOps Readiness` : OK
- `SonarQube Analysis` : tourne maintenant avec un SonarQube ephemere dans le job CI
- jobs distants de deploiement (`Update GitOps Manifests`, `Sync ArgoCD`) : **skipped tant que les vrais secrets ArgoCD ne sont pas renseignes**

## 1. Depot GitHub reel
Le depot GitHub reel est :

```powershell
https://github.com/Mejrioussama/Support-flow.git
```

Le `remote origin` doit pointer vers cette URL.

## 2. Ce qui est deja pret dans le depot
- les manifests ArgoCD pointent vers le vrai repo
- les images GHCR utilisent `ghcr.io/mejrioussama`
- les branches `main` et `develop` existent
- le workflow `.github/workflows/ci-cd.yml` sait:
  - valider la readiness distante
  - skipper proprement les jobs distants si les secrets manquent
  - lancer Sonar + GitOps + ArgoCD si les secrets existent

## 3. Secrets GitHub Actions a creer
Dans `GitHub -> Settings -> Secrets and variables -> Actions -> New repository secret`, creer :

- `ARGOCD_SERVER`
  - exemple : `https://argocd.votre-domaine.tld`
- `ARGOCD_AUTH_TOKEN`
  - token genere depuis ArgoCD

## 4. Recuperer les vraies valeurs
### SonarQube
Plus besoin de secret SonarQube dans GitHub Actions.

Le workflow demarre maintenant :
- `sonarqube-postgres`
- `sonarqube`

directement dans le job CI, puis genere un token temporaire pour l analyse.

### ArgoCD
- URL : l URL publique de ton serveur ArgoCD
- Token :

```bash
argocd login <argocd-server>
argocd account generate-token
```

ou bien :

```bash
kubectl -n argocd exec -it deploy/argocd-server -- argocd account generate-token
```

## 5. Validation locale avant saisie des secrets
Tu peux verifier l etat GitOps du depot avec :

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate-remote-gitops.ps1
```

Avec les vraies valeurs :

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate-remote-gitops.ps1 `
  -ArgoCdServer "https://argocd.votre-domaine.tld" `
  -ArgoCdAuthToken "<token-argocd>" `
  -CheckRemoteEndpoints
```

## 6. Comportement du workflow
Le job `Remote GitOps Readiness`:
- ne casse plus inutilement la CI locale
- resume clairement les secrets ArgoCD manquants
- active les jobs de deploiement seulement quand la configuration est complete

Le job `SonarQube Analysis` :
- ne depend plus d un SonarQube externe
- lance son propre SonarQube ephemere dans GitHub Actions
- n exige plus `SONAR_HOST_URL` ni `SONAR_TOKEN`

Donc :
- push sur `develop` -> cible `staging`
- push sur `main` -> cible `prod`

## 7. Verification ArgoCD
Appliquer une premiere fois les applications :

```bash
kubectl apply -n argocd -f argocd/supportflow-staging.yaml
kubectl apply -n argocd -f argocd/supportflow-prod.yaml
```

Puis verifier :
- application `supportflow-staging`
- application `supportflow-prod`
- `Sync Status`
- `Health Status`

## 8. Validation attendue apres ajout des secrets
### Push sur `develop`
- build backend/frontend
- security scan
- analyse Sonar
- build/push GHCR
- update `k8s/overlays/staging`
- sync ArgoCD `supportflow-staging`

### Push sur `main`
- meme chaine vers `prod`

## 9. Limite restante
Le depot est pret, mais **les vraies valeurs distantes** ne sont pas stockees ici.

Pour terminer completement la chaine distante, il reste seulement a :
1. creer les 2 secrets GitHub ArgoCD
2. verifier l accessibilite reelle d ArgoCD
