param(
    [switch]$RebuildBackend = $false
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Wait-HttpOk {
    param(
        [string]$Name,
        [string]$Url,
        [int]$TimeoutSeconds = 180
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 10
            if ([int]$response.StatusCode -eq 200) {
                Write-Host "[OK] $Name" -ForegroundColor Green
                return
            }
        } catch {
            Start-Sleep -Seconds 5
        }
    }

    throw "$Name indisponible apres $TimeoutSeconds secondes"
}

New-Item -ItemType Directory -Force -Path (Join-Path $root "logs") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $root "uploads") | Out-Null

if ($RebuildBackend) {
    Write-Host "[INFO] Rebuild backend avec remount des dossiers runtime" -ForegroundColor Yellow
    docker compose up -d --build --force-recreate backend | Out-Null
} else {
    Write-Host "[INFO] Recreate backend pour remonter logs/uploads" -ForegroundColor Yellow
    docker compose up -d --force-recreate backend | Out-Null
}

Wait-HttpOk -Name "Backend health" -Url "http://localhost:8082/api/actuator/health"
Wait-HttpOk -Name "Keycloak OIDC" -Url "http://localhost:8180/realms/supportflow/.well-known/openid-configuration"

Write-Host "[INFO] Reseed du jeu de donnees demo via le profile docker 'demo'" -ForegroundColor Yellow
docker compose --profile demo up demo-data-loader

Write-Host ""
Write-Host "Reset demo termine." -ForegroundColor Green
Write-Host "Lancer maintenant :" -ForegroundColor Cyan
Write-Host "powershell -ExecutionPolicy Bypass -File .\\scripts\\pre-demo-check.ps1" -ForegroundColor Cyan
