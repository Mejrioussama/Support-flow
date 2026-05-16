param(
    [string]$ArgoCdServer,
    [string]$ArgoCdAuthToken,
    [switch]$CheckRemoteEndpoints
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$pass = 0
$fail = 0

function Add-Pass {
    param([string]$Message)
    $script:pass++
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Add-Fail {
    param([string]$Message)
    $script:fail++
    Write-Host "[KO] $Message" -ForegroundColor Red
}

function Test-FileContainsNoPattern {
    param(
        [string]$Path,
        [string]$Pattern,
        [string]$Message
    )

    $fullPath = Join-Path $root $Path
    $content = Get-Content -LiteralPath $fullPath -Raw
    if ($content -match $Pattern) {
        Add-Fail $Message
    } else {
        Add-Pass $Message
    }
}

function Test-FileContainsPattern {
    param(
        [string]$Path,
        [string]$Pattern,
        [string]$Message
    )

    $fullPath = Join-Path $root $Path
    $content = Get-Content -LiteralPath $fullPath -Raw
    if ($content -match $Pattern) {
        Add-Pass $Message
    } else {
        Add-Fail $Message
    }
}

Write-Host "REMOTE GITOPS VALIDATION" -ForegroundColor Cyan
Write-Host "Repository root: $root"
Write-Host ""

Test-FileContainsPattern 'argocd\supportflow-staging.yaml' 'repoURL:\s*https://github\.com/Mejrioussama/Support-flow\.git' 'ArgoCD staging pointe vers le vrai repo GitHub'
Test-FileContainsPattern 'argocd\supportflow-prod.yaml' 'repoURL:\s*https://github\.com/Mejrioussama/Support-flow\.git' 'ArgoCD prod pointe vers le vrai repo GitHub'
Test-FileContainsNoPattern 'argocd\supportflow-staging.yaml' 'example/support-flow' 'ArgoCD staging ne reference plus le repo exemple'
Test-FileContainsNoPattern 'argocd\supportflow-prod.yaml' 'example/support-flow' 'ArgoCD prod ne reference plus le repo exemple'

Test-FileContainsPattern 'k8s\base\backend-deployment.yaml' 'ghcr\.io/Mejrioussama/supportflow-backend' 'Image backend GHCR alignee sur le vrai owner'
Test-FileContainsPattern 'k8s\base\frontend-deployment.yaml' 'ghcr\.io/Mejrioussama/supportflow-frontend' 'Image frontend GHCR alignee sur le vrai owner'
Test-FileContainsPattern '.github\workflows\ci-cd.yml' 'ARGOCD_AUTH_TOKEN' 'Workflow CI/CD attend bien le secret ARGOCD_AUTH_TOKEN'
Test-FileContainsPattern '.github\workflows\ci-cd.yml' 'supportflow-\$\{\{ env\.K8S_ENV \}\}' 'Workflow CI/CD cible bien les applications ArgoCD nommees par environnement'
Test-FileContainsPattern '.github\workflows\ci-cd.yml' 'Start ephemeral SonarQube stack' 'Le workflow CI/CD demarre SonarQube localement dans le job d analyse'

$remoteHeads = git ls-remote --heads origin main develop 2>$null
if ($LASTEXITCODE -eq 0 -and $remoteHeads -match 'refs/heads/main' -and $remoteHeads -match 'refs/heads/develop') {
    Add-Pass 'Les branches distantes main et develop existent sur origin'
} else {
    Add-Fail 'Les branches distantes main et develop doivent exister sur origin'
}

if ($ArgoCdServer) {
    Add-Pass 'Valeur fournie pour ARGOCD_SERVER'
} else {
    Add-Fail 'ARGOCD_SERVER non fourni pour validation locale'
}

if ($ArgoCdAuthToken) {
    Add-Pass 'Valeur fournie pour ARGOCD_AUTH_TOKEN'
} else {
    Add-Fail 'ARGOCD_AUTH_TOKEN non fourni pour validation locale'
}

if ($CheckRemoteEndpoints) {
    if ($ArgoCdServer) {
        try {
            $headers = @{}
            if ($ArgoCdAuthToken) {
                $headers['Authorization'] = "Bearer $ArgoCdAuthToken"
            }
            $argoResponse = Invoke-RestMethod -Uri ($ArgoCdServer.TrimEnd('/') + '/api/version') -Headers $headers -Method Get -TimeoutSec 20
            if ($argoResponse.Version -or $argoResponse.version) {
                Add-Pass 'Serveur ArgoCD joignable'
            } else {
                Add-Fail 'Serveur ArgoCD joignable mais reponse inattendue'
            }
        } catch {
            Add-Fail "Serveur ArgoCD non joignable: $($_.Exception.Message)"
        }
    }
}

Write-Host ""
Write-Host "Secrets GitHub Actions a configurer:" -ForegroundColor Cyan
Write-Host " - ARGOCD_SERVER"
Write-Host " - ARGOCD_AUTH_TOKEN"
Write-Host ""
Write-Host "Resultat: PASS=$pass | KO=$fail"

if ($fail -eq 0) {
    Write-Host "REMOTE GITOPS READY" -ForegroundColor Green
    exit 0
}

Write-Host "REMOTE GITOPS INCOMPLETE" -ForegroundColor Yellow
exit 1
