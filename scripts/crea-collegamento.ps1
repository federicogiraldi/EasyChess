# Crea sul desktop il collegamento "EasyChess" che apre l'app in una finestra dedicata.
#
#   (default)  versione online su GitHub Pages: si apre subito, non serve Node né un server,
#              e dopo la prima apertura funziona anche offline (service worker).
#   -Locale    "EasyChess (locale)": avvia la versione della cartella con un server locale
#              (utile per provare aperture nuove prima di pubblicarle).
#
# Uso: tasto destro > "Esegui con PowerShell", oppure:
#   powershell -ExecutionPolicy Bypass -File scripts\crea-collegamento.ps1 [-Locale]

param([switch]$Locale)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$url = 'https://federicogiraldi.github.io/EasyChess/'
$icon = Join-Path $root 'assets\easychess.ico'
if (-not (Test-Path $icon)) { & (Join-Path $PSScriptRoot 'genera-icone.ps1') | Out-Null }

function Find-Browser {
    # Il browser predefinito se è Chrome (i progressi restano nel suo profilo), altrimenti Edge.
    $progId = (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice' -ErrorAction SilentlyContinue).ProgId
    $edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
    $chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($progId -like 'ChromeHTML*' -and $chrome) { return $chrome }
    if ($edge) { return $edge }
    return $chrome
}

$desktop = [Environment]::GetFolderPath('Desktop')
$shell = New-Object -ComObject WScript.Shell

if ($Locale) {
    $lnk = $shell.CreateShortcut((Join-Path $desktop 'EasyChess (locale).lnk'))
    $lnk.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
    $lnk.Arguments = '"' + (Join-Path $root 'EasyChess.vbs') + '"'
    $lnk.Description = 'Avvia EasyChess dalla cartella del progetto (server locale)'
} else {
    $browser = Find-Browser
    if (-not $browser) { throw 'Né Chrome né Edge trovati: apri a mano ' + $url }
    $lnk = $shell.CreateShortcut((Join-Path $desktop 'EasyChess.lnk'))
    $lnk.TargetPath = $browser
    $lnk.Arguments = "--app=$url --window-size=1360,900"
    $lnk.Description = 'Apri EasyChess (allenatore di aperture)'
}
$lnk.WorkingDirectory = $root
$lnk.IconLocation = $icon
$lnk.Save()

Write-Output "Collegamento creato: $($lnk.FullName)"
