param(
    [string]$SonarToken,
    [string]$SonarHostUrl = "http://host.docker.internal:9000",
    [string]$ProjectDir = "C:\Users\21655\Desktop\Support-flow"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($SonarToken)) {
    throw "Le parametre -SonarToken est obligatoire."
}

Push-Location $ProjectDir
try {
    Write-Host "Compilation backend pour SonarQube..." -ForegroundColor Cyan
    Push-Location (Join-Path $ProjectDir "backend")
    try {
        .\mvnw.cmd -q -DskipTests compile
    } finally {
        Pop-Location
    }

    Write-Host "Lancement de l'analyse SonarQube locale..." -ForegroundColor Cyan
    docker run --rm `
      -e SONAR_HOST_URL=$SonarHostUrl `
      -e SONAR_TOKEN=$SonarToken `
      -v "${ProjectDir}:/usr/src" `
      sonarsource/sonar-scanner-cli
} finally {
    Pop-Location
}
