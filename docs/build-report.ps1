param(
    [string]$FileName = "rapport_stage_supportflow_80p.tex",
    [switch]$UseDocker
)

$ErrorActionPreference = "Stop"

$reportPath = Join-Path $PSScriptRoot $FileName
$portableTectonicPath = Join-Path (Split-Path $PSScriptRoot -Parent) "tools\\tectonic\\tectonic.exe"
$tectonic = if (Test-Path $portableTectonicPath) {
    [PSCustomObject]@{ Source = $portableTectonicPath; Portable = $true }
} else {
    Get-Command tectonic -ErrorAction SilentlyContinue
}
$pdflatex = Get-Command pdflatex -ErrorAction SilentlyContinue
$docker = Get-Command docker -ErrorAction SilentlyContinue
$dockerImage = "fabianhauser/tectonic:latest"

if (-not (Test-Path $reportPath)) {
    Write-Host "Fichier introuvable : $reportPath" -ForegroundColor Red
    exit 1
}

Push-Location $PSScriptRoot
try {
    if ($UseDocker) {
        if (-not $docker) {
            Write-Host "Docker n'est pas disponible. Impossible d'utiliser la compilation conteneurisee." -ForegroundColor Red
            exit 1
        }

        $mountPath = ($PSScriptRoot -replace '\\', '/')
        if ($mountPath -match '^[A-Za-z]:') {
            $drive = $mountPath.Substring(0,1).ToLower()
            $rest = $mountPath.Substring(2)
            $mountPath = "/$drive$rest"
        }

        Write-Host "Compilation du rapport via Docker ($dockerImage)..." -ForegroundColor Cyan
        & $docker.Source run --rm -v "${mountPath}:/work" -w /work $dockerImage `
            $FileName --keep-logs --keep-intermediates -o /work
        exit $LASTEXITCODE
    }

    if ($tectonic) {
        if ($tectonic.PSObject.Properties.Name -contains "Portable") {
            Write-Host "Compilation du rapport via Tectonic portable local..." -ForegroundColor Cyan
        } else {
            Write-Host "Compilation du rapport via Tectonic..." -ForegroundColor Cyan
        }
        & $tectonic.Source $reportPath
        exit $LASTEXITCODE
    }

    if ($pdflatex) {
        Write-Host "Compilation du rapport via pdflatex..." -ForegroundColor Cyan
        & $pdflatex.Source -interaction=nonstopmode -halt-on-error $reportPath
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        & $pdflatex.Source -interaction=nonstopmode -halt-on-error $reportPath
        exit $LASTEXITCODE
    }

    if ($docker) {
        Write-Host "Aucun moteur LaTeX local detecte. Utilisez le mode Docker :" -ForegroundColor Yellow
        Write-Host ".\docs\build-report.ps1 -UseDocker" -ForegroundColor Yellow
        exit 1
    }

    Write-Host "Aucun moteur LaTeX detecte (ni tectonic, ni pdflatex, ni Docker)." -ForegroundColor Red
    Write-Host "Installez Tectonic, TeX Live, MiKTeX ou utilisez Docker Desktop." -ForegroundColor Yellow
    exit 1
}
finally {
    Pop-Location
}
