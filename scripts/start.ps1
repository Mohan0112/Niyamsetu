$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$env:HF_HUB_OFFLINE = "1"
$env:TRANSFORMERS_OFFLINE = "1"
$env:NIYAMSETU_PORT = if ($env:NIYAMSETU_PORT) { $env:NIYAMSETU_PORT } else { "8765" }

Write-Host "Starting NiyamSetu offline at http://127.0.0.1:$env:NIYAMSETU_PORT"
Write-Host "No package install or internet access is required."
node backend/server.js
