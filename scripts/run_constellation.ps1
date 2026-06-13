# Run a 3-satellite SCSP constellation over a real Redis bus (Phase 2 F-11 full mode).
#
#   .\scripts\run_constellation.ps1 -RedisUrl redis://localhost:6379/0
#
# Starts three backend instances in separate windows:
#   SAT_ALPHA   → :8000   (the one the frontend talks to)
#   SAT_BRAVO   → :8010
#   SAT_CHARLIE → :8020
#
# Each publishes its HIGH-risk command detections to scsp:constellation:alerts
# and elevates approval tiers when a peer reports one. To demo: submit
# DISABLE_SAFE_MODE through SAT_BRAVO's API (port 8010) and watch SAT_ALPHA's
# Mission Control constellation panel flip to "elevation active".
#
# Requires Redis reachable at -RedisUrl (e.g. `docker compose up redis`,
# Memurai, or WSL redis-server). Without Redis each instance falls back to its
# own in-process simulator and they will NOT see each other.

param(
    [string]$RedisUrl = "redis://localhost:6379/0"
)

$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root ".venv\Scripts\python.exe"
$backend = Join-Path $root "backend"

$instances = @(
    @{ Id = "SAT_ALPHA";   Port = 8000 },
    @{ Id = "SAT_BRAVO";   Port = 8010 },
    @{ Id = "SAT_CHARLIE"; Port = 8020 }
)

foreach ($inst in $instances) {
    Write-Host "Starting $($inst.Id) on port $($inst.Port)..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList @(
        "-NoExit", "-Command",
        "`$env:SATELLITE_ID='$($inst.Id)'; " +
        "`$env:REDIS_URL='$RedisUrl'; " +
        "`$env:APP_PORT='$($inst.Port)'; " +
        "`$env:PYTHONIOENCODING='utf-8'; " +
        "`$host.UI.RawUI.WindowTitle='SCSP $($inst.Id)'; " +
        "cd '$backend'; & '$python' -m uvicorn app.main:app --host 0.0.0.0 --port $($inst.Port)"
    )
}

Write-Host ""
Write-Host "Constellation starting. Verify each instance:" -ForegroundColor Green
Write-Host "  (login first, then) GET http://localhost:8000/api/v1/constellation/status  -> bus: redis"
Write-Host "Cross-satellite demo: submit a HIGH command via SAT_BRAVO (:8010) and watch"
Write-Host "SAT_ALPHA's Mission Control constellation panel elevate."
