# Chay tu thu muc bat ky; chi tao .env khi chua ton tai.
[CmdletBinding()]
param([switch]$NoSeed)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
try {
    if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Can cai Docker Desktop va bat Linux containers truoc.'
    }
    docker info --format '{{.ServerVersion}}' 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'Hay mo Docker Desktop, doi Engine running roi chay lai.' }
    if (!(Test-Path -LiteralPath 'be/.env')) {
        $randomBytes = New-Object byte[] 48
        $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $generator.GetBytes($randomBytes) } finally { $generator.Dispose() }
        $secret = [Convert]::ToBase64String($randomBytes)
        $template = Get-Content -LiteralPath 'be/.env.example' -Raw
        $template = $template -replace '(?m)^JWT_SECRET=.*$', "JWT_SECRET=$secret"
        [IO.File]::WriteAllText((Join-Path $projectRoot 'be/.env'), $template, (New-Object Text.UTF8Encoding $false))
    }
    docker compose up --build -d --wait --wait-timeout 180
    if ($LASTEXITCODE -ne 0) { throw 'Khoi dong that bai. Xem: docker compose logs --tail 100' }
    if (!$NoSeed) {
        docker compose exec -T backend python seed.py --demo
        if ($LASTEXITCODE -ne 0) { throw 'Tao du lieu demo that bai. Xem log backend.' }
    }
    $webPort = if ($env:WEB_PORT) { $env:WEB_PORT } else { '3000' }
    Write-Host "Demo: http://localhost:$webPort"
    Write-Host 'Kiem tra: docker compose ps'
} finally {
    Pop-Location
}
