# Crea sul desktop il collegamento "EasyChess" che apre l'app in una finestra dedicata.
# Uso: tasto destro > "Esegui con PowerShell", oppure: powershell -ExecutionPolicy Bypass -File scripts\crea-collegamento.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$icon = Join-Path $root 'assets\easychess.ico'
if (-not (Test-Path $icon)) { & (Join-Path $PSScriptRoot 'genera-icone.ps1') | Out-Null }

$lnkPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'EasyChess.lnk'
$lnk = (New-Object -ComObject WScript.Shell).CreateShortcut($lnkPath)
$lnk.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
$lnk.Arguments = '"' + (Join-Path $root 'EasyChess.vbs') + '"'
$lnk.WorkingDirectory = $root
$lnk.IconLocation = $icon
$lnk.Description = 'Avvia EasyChess (allenatore di aperture)'
$lnk.Save()

Write-Output "Collegamento creato: $lnkPath"
