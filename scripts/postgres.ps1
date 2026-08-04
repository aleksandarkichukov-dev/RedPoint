<#
.SYNOPSIS
  Start, stop or inspect the local PostgreSQL used for development.

.DESCRIPTION
  FALLBACK ONLY. The normal way to get a database is `docker compose up -d`,
  which also brings up Redis. Use this script only when Docker is unavailable.

  It drives portable PostgreSQL 17 binaries under
  %LOCALAPPDATA%\redpoint-postgres, from the period when Docker could not run
  on this machine at all. Nothing is installed system-wide, there is no Windows
  service, and removing it is a matter of deleting that folder.

  Both this and the compose stack bind port 5432, so never run them together.

.EXAMPLE
  ./scripts/postgres.ps1 start
  ./scripts/postgres.ps1 status
  ./scripts/postgres.ps1 stop
#>
param(
  [Parameter(Position = 0)]
  [ValidateSet("start", "stop", "restart", "status", "psql", "reset")]
  [string]$Action = "status"
)

$ErrorActionPreference = "Stop"

$Root = Join-Path $env:LOCALAPPDATA "redpoint-postgres"
$Bin = Join-Path $Root "pgsql\bin"
$Data = Join-Path $Root "data"
$Log = Join-Path $Root "server.log"

if (-not (Test-Path (Join-Path $Bin "pg_ctl.exe"))) {
  throw "PostgreSQL binaries not found at $Bin. See CLAUDE.md for how they were installed."
}

# Read the password out of the backend env file rather than duplicating it.
function Get-DbPassword {
  $envFile = Join-Path $PSScriptRoot "..\apps\backend\.env"
  if (-not (Test-Path $envFile)) { throw "apps/backend/.env not found" }
  $line = Get-Content $envFile | Where-Object { $_ -like "DATABASE_URL=*" }
  if (-not $line) { throw "DATABASE_URL not set in apps/backend/.env" }
  return ($line -replace '.*://redpoint:([^@]+)@.*', '$1')
}

# pg_ctl inherits the console handle and would hang the caller, so it always
# runs detached with its output redirected.
function Invoke-PgCtl([string[]]$PgArgs) {
  Start-Process -FilePath (Join-Path $Bin "pg_ctl.exe") `
    -ArgumentList (@("-D", "`"$Data`"", "-l", "`"$Log`"", "-w") + $PgArgs) `
    -NoNewWindow -Wait `
    -RedirectStandardOutput (Join-Path $Root "ctl.out") `
    -RedirectStandardError (Join-Path $Root "ctl.err")
}

switch ($Action) {
  "start" {
    Invoke-PgCtl @("start")
    Start-Sleep -Seconds 2
    Write-Output "postgres started on :5432"
  }
  "stop" {
    Invoke-PgCtl @("-m", "fast", "stop")
    Write-Output "postgres stopped"
  }
  "restart" {
    Invoke-PgCtl @("-m", "fast", "restart")
    Start-Sleep -Seconds 2
    Write-Output "postgres restarted"
  }
  "status" {
    $listening = $null
    try { $listening = Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction Stop } catch {}
    if ($listening) {
      $env:PGPASSWORD = Get-DbPassword
      $v = & (Join-Path $Bin "psql.exe") -U redpoint -h 127.0.0.1 -p 5432 -d redpoint -tAc "SELECT version()" 2>&1
      Write-Output "listening on :5432"
      Write-Output ($v | Out-String).Trim()
    } else {
      Write-Output "not running. Start it with: ./scripts/postgres.ps1 start"
    }
  }
  "psql" {
    $env:PGPASSWORD = Get-DbPassword
    & (Join-Path $Bin "psql.exe") -U redpoint -h 127.0.0.1 -p 5432 -d redpoint
  }
  "reset" {
    # Drops the database and recreates it empty. Migrations and seed have to be
    # re-run afterwards; this only exists because a half-seeded catalogue is
    # harder to reason about than an empty one.
    $env:PGPASSWORD = Get-DbPassword
    & (Join-Path $Bin "dropdb.exe") -U redpoint -h 127.0.0.1 -p 5432 --if-exists redpoint
    & (Join-Path $Bin "createdb.exe") -U redpoint -h 127.0.0.1 -p 5432 redpoint
    Write-Output "database dropped and recreated. Now run:"
    Write-Output "  pnpm --filter @redpoint/backend exec medusa db:migrate"
    Write-Output "  pnpm --filter @redpoint/backend seed"
  }
}
