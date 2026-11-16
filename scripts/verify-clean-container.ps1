param(
    [Parameter(Mandatory=$true)][string]$DatabaseUrl,
    [string]$Image = 'garagecar-hardening:20261116'
)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskTests = Join-Path $taskRoot 'be/tests'
$taskVerifier = Join-Path $taskRoot 'scripts/clean_runtime_check.py'
$taskResults = Join-Path $taskRoot 'outputs/security-hardening-20261116'
New-Item -ItemType Directory -Path $taskResults -Force | Out-Null
# Only a disposable schema is created by the tests. Never migrate the public schema here.
& docker run --rm --user 0 -e "DATABASE_URL=$DatabaseUrl" -e 'JWT_SECRET=garagecar-container-test-secret-at-least-32-bytes' -e 'PYTHONPATH=/app:/app/tests' -e 'GARAGE_JUNIT_PATH=/results/container.xml' -v "${taskResults}:/results" -v "${taskTests}:/app/tests:ro" -v "${taskVerifier}:/verify/clean_runtime_check.py:ro" $Image python /verify/clean_runtime_check.py
if ($LASTEXITCODE -ne 0) { throw 'Clean-container authentication regression failed' }
