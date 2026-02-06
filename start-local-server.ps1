$port = 8000
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  Select-Object -First 1 -ExpandProperty OwningProcess

if ($existing) {
  $existingProc = Get-CimInstance Win32_Process -Filter "ProcessId=$existing" -ErrorAction SilentlyContinue
  $cmdLine = if ($existingProc) { $existingProc.CommandLine } else { "" }

  if ($cmdLine -match "local_server\.py") {
    Write-Output "Server already running on http://localhost:$port (PID $existing)"
    exit 0
  }

  try {
    Stop-Process -Id $existing -Force -ErrorAction Stop
    Write-Output "Stopped existing process on port $port (PID $existing)"
  } catch {
    if ($_.Exception.Message -match "Cannot find a process") {
      Write-Output "Existing PID $existing already exited."
    } else {
      Write-Output "Could not stop existing PID ${existing}: $($_.Exception.Message)"
      exit 1
    }
  }
}

$proc = Start-Process -FilePath python -ArgumentList "local_server.py" -WorkingDirectory $root -WindowStyle Hidden -PassThru
Write-Output "Server started on http://localhost:$port (PID $($proc.Id))"
