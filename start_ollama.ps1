$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
Set-Location $root

$env:HF_HUB_OFFLINE = "1"
$env:TRANSFORMERS_OFFLINE = "1"
$env:NIYAMSETU_PORT = if ($env:NIYAMSETU_PORT) { $env:NIYAMSETU_PORT } else { "8765" }

# MODE 1: OLLAMA
$env:LLM_PROVIDER = "ollama"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " NiyamSetu -> Mode 1: Local Ollama Model" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Ensure Ollama is running on localhost:11434 with 'llama3' pulled."
Write-Host "Starting server at http://127.0.0.1:$env:NIYAMSETU_PORT`n"

node --env-file=.env backend/server.js
