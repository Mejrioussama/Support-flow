# GitOps local avec kind + ArgoCD

Cette procédure sert à lancer un cluster Kubernetes local quand Docker Desktop Kubernetes n'est pas activé.

## 1. Créer le cluster local

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-kind-cluster.ps1
```

## 2. Installer ArgoCD et l'application SupportFlow locale

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-local-argocd.ps1
```

## 3. Vérifier

```powershell
kubectl get applications -n argocd
kubectl get pods -n argocd
kubectl get pods -n supportflow
```

## 4. Ouvrir ArgoCD

```powershell
kubectl port-forward svc/argocd-server -n argocd 8085:443
```

Puis ouvrir `https://localhost:8085`.

## 5. Ouvrir SupportFlow

```powershell
kubectl port-forward svc/supportflow-frontend -n supportflow 8088:80
kubectl port-forward svc/supportflow-backend -n supportflow 8089:8080
```

Puis ouvrir `http://localhost:8088`.

## Notes

- Cette variante locale utilise l'overlay `k8s/overlays/local`.
- Le backend Kubernetes consomme `Keycloak`, `Alfresco` et `AI Agent` déjà démarrés sur la machine via `host.docker.internal`.
- Les overlays `staging` et `prod` ne sont pas modifiés par cette procédure.
