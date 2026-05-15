param(
    [string]$FileName = "memoire_supportflow_80p.tex"
)

$ErrorActionPreference = "Stop"

$reportPath = Join-Path $PSScriptRoot $FileName
$tectonic = Get-Command tectonic -ErrorAction SilentlyContinue

if (-not (Test-Path $reportPath)) {
    Write-Host "Fichier introuvable : $reportPath" -ForegroundColor Red
    exit 1
}

if (-not $tectonic) {
    Write-Host "Tectonic n'est pas installe ou n'est pas dans le PATH." -ForegroundColor Yellow
    Write-Host "Installez Tectonic puis relancez ce script pour generer le PDF." -ForegroundColor Yellow
    exit 1
}

Push-Location $PSScriptRoot
try {
    & $tectonic.Source $reportPath
}
finally {
    Pop-Location
}
