$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
Set-Location $root

$env:HF_HUB_OFFLINE = "1"
$env:TRANSFORMERS_OFFLINE = "1"
$env:NIYAMSETU_PORT = if ($env:NIYAMSETU_PORT) { $env:NIYAMSETU_PORT } else { "8765" }

# MODE 2: GEMINI (Internet)
$env:LLM_PROVIDER = "gemini"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " NiyamSetu -> Mode 2: Gemini API (Internet)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Reading GEMINI_API_KEY from .env file..."
Write-Host "Starting server at http://127.0.0.1:$env:NIYAMSETU_PORT`n"

node --env-file=.env backend/server.js
