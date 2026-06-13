# tasks.ps1 — PowerShell replacement for Makefile
# Usage: .\tasks.ps1 <target>
# Example: .\tasks.ps1 dev

param([string]$target = "help")

$root    = $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$obc     = Join-Path $root "obc"

function Show-Help {
    Write-Host ""
    Write-Host "SCSP Task Runner" -ForegroundColor Cyan
    Write-Host "Usage: .\tasks.ps1 <target>" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Targets:"
    Write-Host "  dev           Start backend(:8000) + frontend(:3000) + obc(:9000)" -ForegroundColor Green
    Write-Host "  run-backend   Start FastAPI backend only"
    Write-Host "  run-frontend  Start Next.js frontend only"
    Write-Host "  run-obc       Start mock OBC simulator only"
    Write-Host "  demo-reset    Truncate all DB data + re-seed"
    Write-Host "  demo-verify   Run all 11 demo checks"
    Write-Host "  demo-seed     Seed demo state without truncating"
    Write-Host "  test-unit     Run pytest unit tests with coverage"
    Write-Host "  test-all      Run unit + integration tests"
    Write-Host "  db-migrate    Apply database migration"
    Write-Host "  db-setup      Create PostgreSQL user and databases"
    Write-Host "  install       Install all dependencies (pip + npm)"
    Write-Host "  tunnel        Start ngrok tunnel on port 3000"
    Write-Host "  help          Show this help message"
    Write-Host ""
}

function Start-Dev {
    Write-Host "Starting SCSP services..." -ForegroundColor Cyan
    # Backend
    Start-Process powershell -ArgumentList "-NoExit", "-Command",
        "cd '$backend'; `$env:PYTHONPATH='$backend'; uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload" `
        -WindowStyle Normal
    # Frontend
    Start-Process powershell -ArgumentList "-NoExit", "-Command",
        "cd '$frontend'; npm run dev" `
        -WindowStyle Normal
    # OBC simulator
    Start-Process powershell -ArgumentList "-NoExit", "-Command",
        "cd '$obc'; python obc_simulator.py" `
        -WindowStyle Normal
    Write-Host "Services started in separate windows." -ForegroundColor Green
    Write-Host "  Backend:  http://localhost:8000/docs"
    Write-Host "  Frontend: http://localhost:3000"
    Write-Host "  OBC:      UDP localhost:9000"
}

function Start-Backend {
    Write-Host "Starting backend..." -ForegroundColor Cyan
    $env:PYTHONPATH = $backend
    Set-Location $backend
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
}

function Start-Frontend {
    Write-Host "Starting frontend..." -ForegroundColor Cyan
    Set-Location $frontend
    npm run dev
}

function Start-Obc {
    Write-Host "Starting OBC simulator..." -ForegroundColor Cyan
    Set-Location $obc
    python obc_simulator.py
}

function Invoke-DemoReset {
    Write-Host "Resetting demo state..." -ForegroundColor Yellow
    $env:PYTHONPATH = $backend
    Set-Location $backend
    python scripts/reset_demo.py
}

function Invoke-DemoVerify {
    Write-Host "Running demo verification..." -ForegroundColor Cyan
    $env:PYTHONPATH = $backend
    Set-Location $backend
    python scripts/verify_demo_state.py
}

function Invoke-DemoSeed {
    Write-Host "Seeding demo state..." -ForegroundColor Cyan
    $env:PYTHONPATH = $backend
    Set-Location $backend
    python scripts/seed_demo.py
}

function Invoke-TestUnit {
    Write-Host "Running unit tests..." -ForegroundColor Cyan
    $env:PYTHONPATH = $backend
    $env:DEMO_MODE = "true"
    Set-Location $backend
    pytest tests/unit --cov=app --cov-report=term-missing -v
}

function Invoke-TestAll {
    Write-Host "Running all tests..." -ForegroundColor Cyan
    $env:PYTHONPATH = $backend
    $env:DEMO_MODE = "true"
    Set-Location $backend
    pytest tests/ --cov=app --cov-report=term-missing -v
}

function Invoke-DbMigrate {
    Write-Host "Applying database migration..." -ForegroundColor Cyan
    $migrationFile = Join-Path $backend "migrations\001_initial_schema.sql"
    $dbUrl = $env:DATABASE_URL
    if (-not $dbUrl) { $dbUrl = "postgresql://scsp:scsp_dev@localhost:5432/scsp_db" }
    psql $dbUrl -f $migrationFile
    Write-Host "Migration applied." -ForegroundColor Green
}

function Invoke-DbSetup {
    Write-Host "Creating PostgreSQL user and databases..." -ForegroundColor Cyan
    psql -U postgres -c "CREATE USER scsp WITH PASSWORD 'scsp_dev';"
    psql -U postgres -c "CREATE DATABASE scsp_db OWNER scsp;"
    psql -U postgres -c "CREATE DATABASE scsp_test OWNER scsp;"
    Write-Host "Database setup complete." -ForegroundColor Green
}

function Invoke-Install {
    Write-Host "Installing Python dependencies..." -ForegroundColor Cyan
    Set-Location $backend
    pip install -r requirements.txt
    Write-Host "Installing Node dependencies..." -ForegroundColor Cyan
    Set-Location $frontend
    npm install
    Write-Host "All dependencies installed." -ForegroundColor Green
}

function Start-Tunnel {
    Write-Host "Starting ngrok tunnel on port 3000..." -ForegroundColor Cyan
    ngrok http 3000
}

switch ($target.ToLower()) {
    "dev"          { Start-Dev }
    "run-backend"  { Start-Backend }
    "run-frontend" { Start-Frontend }
    "run-obc"      { Start-Obc }
    "demo-reset"   { Invoke-DemoReset }
    "demo-verify"  { Invoke-DemoVerify }
    "demo-seed"    { Invoke-DemoSeed }
    "test-unit"    { Invoke-TestUnit }
    "test-all"     { Invoke-TestAll }
    "db-migrate"   { Invoke-DbMigrate }
    "db-setup"     { Invoke-DbSetup }
    "install"      { Invoke-Install }
    "tunnel"       { Start-Tunnel }
    "help"         { Show-Help }
    default {
        Write-Host "Unknown target: $target" -ForegroundColor Red
        Show-Help
        exit 1
    }
}
