param(
    [string]$KindBinary = "tools/kind.exe",
    [string]$ClusterName = "supportflow"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $KindBinary)) {
    New-Item -ItemType Directory -Force (Split-Path $KindBinary) | Out-Null
    Invoke-WebRequest -Uri "https://github.com/kubernetes-sigs/kind/releases/download/v0.27.0/kind-windows-amd64" -OutFile $KindBinary
}

$configPath = Join-Path (Get-Location) ".kind-cluster.yaml"
@"
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: $ClusterName
nodes:
  - role: control-plane
"@ | Set-Content -Encoding ascii $configPath

$clusters = & $KindBinary get clusters
if ($clusters -contains $ClusterName) {
    Write-Host "Cluster kind '$ClusterName' déjà présent."
} else {
    & $KindBinary create cluster --config $configPath
}

kubectl config use-context "kind-$ClusterName" | Out-Null
kubectl cluster-info
