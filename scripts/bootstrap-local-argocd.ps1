param(
    [string]$Kubectl = "kubectl",
    [string]$ArgoNamespace = "argocd",
    [string]$AppManifest = "argocd/supportflow-local.yaml"
)

$ErrorActionPreference = "Stop"

function Invoke-Step {
    param(
        [string]$Label,
        [scriptblock]$Action
    )

    Write-Host "==> $Label"
    & $Action
}

Invoke-Step "Checking kubectl connectivity" {
    & $Kubectl cluster-info | Out-Null
}

Invoke-Step "Creating namespace $ArgoNamespace if needed" {
    & $Kubectl create namespace $ArgoNamespace --dry-run=client -o yaml | & $Kubectl apply -f -
}

Invoke-Step "Installing ArgoCD core manifests" {
    & $Kubectl apply -n $ArgoNamespace -f "https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml"
}

Invoke-Step "Waiting for ArgoCD server rollout" {
    & $Kubectl rollout status deployment/argocd-server -n $ArgoNamespace --timeout=300s
}

Invoke-Step "Applying local SupportFlow ArgoCD application" {
    & $Kubectl apply -n $ArgoNamespace -f $AppManifest
}

Write-Host ""
Write-Host "Bootstrap terminé."
Write-Host "Vérifications utiles :"
Write-Host "  kubectl get applications -n $ArgoNamespace"
Write-Host "  kubectl get pods -n $ArgoNamespace"
Write-Host "  kubectl get pods -n supportflow"
Write-Host ""
Write-Host "Accès UI ArgoCD :"
Write-Host "  kubectl port-forward svc/argocd-server -n $ArgoNamespace 8085:443"
Write-Host ""
Write-Host "Accès SupportFlow local via port-forward :"
Write-Host "  kubectl port-forward svc/supportflow-frontend -n supportflow 8088:80"
Write-Host "  kubectl port-forward svc/supportflow-backend -n supportflow 8089:8080"
