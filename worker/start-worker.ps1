$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$WorkerEnv = Join-Path $PSScriptRoot ".env"

if (-not (Test-Path -LiteralPath $WorkerEnv)) {
  Write-Error "Missing worker\.env. Copy worker\.env.example to worker\.env and add the required values."
}

Set-Location -LiteralPath $ProjectRoot
$env:DOTENV_CONFIG_PATH = $WorkerEnv
pnpm.cmd run worker
