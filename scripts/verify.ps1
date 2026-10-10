# Chay cac kiem tra va dung ngay neu co loi.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$pythonPath = Join-Path $projectRoot '.venv/Scripts/python.exe'
Push-Location $projectRoot
try {
    if (!(Test-Path -LiteralPath $pythonPath)) { throw 'Tao .venv va cai be/requirements-dev.txt truoc.' }
    & $pythonPath -m ruff check be scripts
    if ($LASTEXITCODE -ne 0) { throw 'Python lint failed' }
    & $pythonPath -m ruff format --check be scripts
    if ($LASTEXITCODE -ne 0) { throw 'Python format failed' }
    & $pythonPath -m pytest -q
    if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed' }
    foreach ($check in @('format:check', 'check:files', 'test')) {
        npm.cmd run $check
        if ($LASTEXITCODE -ne 0) { throw "Frontend check failed: $check" }
    }
} finally {
    Pop-Location
}
