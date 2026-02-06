$port = 8000

$pids = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique

if (-not $pids) {
  Write-Output "No server found on port $port"
  exit 0
}

foreach ($procId in $pids) {
  try {
    Stop-Process -Id $procId -Force -ErrorAction Stop
    Write-Output "Stopped PID $procId on port $port"
  } catch {
    Write-Output "Could not stop PID ${procId}: $($_.Exception.Message)"
  }
}
