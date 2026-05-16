param(
    [string]$RepoUrl = "https://github.com/Mejrioussama/Support-flow.git",

    [string]$GitHubOwner = "Mejrioussama"
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$imageNamespace = "ghcr.io/$($GitHubOwner.ToLowerInvariant())"

function Update-File {
    param(
        [string]$Path,
        [scriptblock]$Transform
    )

    $content = Get-Content -LiteralPath $Path -Raw
    $updated = & $Transform $content
    Set-Content -LiteralPath $Path -Value $updated -NoNewline
}

if ($RepoUrl -notmatch '^https://github\.com/.+/.+\.git$') {
    throw "RepoUrl doit etre de la forme https://github.com/<owner>/<repo>.git"
}

$argocdFiles = @(
    (Join-Path $root 'argocd\supportflow-staging.yaml'),
    (Join-Path $root 'argocd\supportflow-prod.yaml')
)

foreach ($file in $argocdFiles) {
    Update-File -Path $file -Transform {
        param($content)
        $content -replace 'repoURL:\s*https://github\.com/.+/.+\.git', "repoURL: $RepoUrl"
    }
}

$imageMap = @{
    (Join-Path $root 'k8s\base\backend-deployment.yaml') = "$imageNamespace/supportflow-backend:staging"
    (Join-Path $root 'k8s\base\frontend-deployment.yaml') = "$imageNamespace/supportflow-frontend:staging"
    (Join-Path $root 'k8s\overlays\staging\backend-patch.yaml') = "$imageNamespace/supportflow-backend:staging"
    (Join-Path $root 'k8s\overlays\staging\frontend-patch.yaml') = "$imageNamespace/supportflow-frontend:staging"
    (Join-Path $root 'k8s\overlays\prod\backend-patch.yaml') = "$imageNamespace/supportflow-backend:prod"
    (Join-Path $root 'k8s\overlays\prod\frontend-patch.yaml') = "$imageNamespace/supportflow-frontend:prod"
}

foreach ($entry in $imageMap.GetEnumerator()) {
    Update-File -Path $entry.Key -Transform {
        param($content)
        $content -replace 'image:\s*ghcr\.io/.+/supportflow-(backend|frontend):[A-Za-z0-9._-]+', "image: $($entry.Value)"
    }
}

Write-Host "Remote GitOps configuration applied."
Write-Host "Repo URL: $RepoUrl"
Write-Host "Image namespace: $imageNamespace"
