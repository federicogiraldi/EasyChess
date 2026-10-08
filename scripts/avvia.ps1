# Avvia EasyChess in una finestra dedicata (modalità app di Edge/Chrome), senza console visibili.
#  1. installa le dipendenze se mancano;
#  2. ricompila se aperture o codice sono più recenti dell'ultima build;
#  3. avvia il server locale in background (se non è già attivo);
#  4. apre http://localhost:5317 in una finestra senza barra degli indirizzi.
# Lo lancia EasyChess.vbs (il collegamento sul desktop).

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$url = 'http://localhost:5317/'
$port = 5317
$log = Join-Path $env:TEMP 'easychess-avvio.log'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Piccola finestra "Avvio in corso" mentre si installa o si compila.
$splash = $null
function Show-Splash([string]$text) {
    if (-not $script:splash) {
        $f = New-Object System.Windows.Forms.Form
        $f.FormBorderStyle = 'None'; $f.StartPosition = 'CenterScreen'; $f.Size = New-Object System.Drawing.Size 360, 110
        $f.BackColor = [System.Drawing.Color]::FromArgb(39, 36, 32); $f.TopMost = $true; $f.ShowInTaskbar = $true; $f.Text = 'EasyChess'
        $icon = Join-Path $root 'assets\easychess.ico'
        if (Test-Path $icon) { $f.Icon = New-Object System.Drawing.Icon $icon }
        $l = New-Object System.Windows.Forms.Label
        $l.Dock = 'Fill'; $l.TextAlign = 'MiddleCenter'; $l.ForeColor = [System.Drawing.Color]::FromArgb(236, 230, 220)
        $l.Font = New-Object System.Drawing.Font 'Segoe UI', 12
        $f.Controls.Add($l)
        $f.Show()
        $script:splash = $f
    }
    $script:splash.Controls[0].Text = "♞  $text"
    [System.Windows.Forms.Application]::DoEvents()
}

function Wait-Process-WithUi($proc) {
    while (-not $proc.HasExited) { [System.Windows.Forms.Application]::DoEvents(); Start-Sleep -Milliseconds 100 }
    if ($proc.ExitCode -ne 0) { throw "Comando fallito (codice $($proc.ExitCode)). Dettagli in $log" }
}

function Run-Hidden([string]$file, [string[]]$arguments) {
    $p = Start-Process -FilePath $file -ArgumentList $arguments -WorkingDirectory $root -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $log -RedirectStandardError "$log.err"
    Wait-Process-WithUi $p
}

function Test-Server {
    # true solo se risponde il server della build (vite preview), non quello di sviluppo di EasyChess.bat.
    # Controlla anche lo script principale: un server avviato prima di una nuova build non lo trova più.
    try {
        $r = Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 2
        if ($r.StatusCode -ne 200 -or $r.Content -match '@vite/client') { return $false }
        $js = [regex]::Match($r.Content, 'src="\.?/?(assets/[^"]+\.js)"').Groups[1].Value
        if (-not $js) { return $false }
        return (Invoke-WebRequest -UseBasicParsing ($url + $js) -Method Head -TimeoutSec 2).StatusCode -eq 200
    } catch { return $false }
}

function Stop-Server {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

function Find-Browser {
    # Preferisci il browser predefinito (così ritrovi i progressi salvati lì), purché supporti la modalità app.
    $progId = (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice' -ErrorAction SilentlyContinue).ProgId
    $edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
    $chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($progId -like 'ChromeHTML*' -and $chrome) { return $chrome }
    if ($edge) { return $edge }
    return $chrome
}

try {
    $node = (Get-Command node -ErrorAction SilentlyContinue).Source
    if (-not $node) { throw 'Node.js non trovato. Installalo da https://nodejs.org e riprova.' }
    $npm = Join-Path (Split-Path $node) 'npm.cmd'

    if (-not (Test-Path (Join-Path $root 'node_modules'))) {
        Show-Splash 'Prima installazione (1-2 minuti)…'
        Run-Hidden $npm @('install')
    }

    # Ricompila se qualcosa è cambiato dopo l'ultima build (es. hai aggiunto un'apertura).
    $dist = Join-Path $root 'dist\index.html'
    $needBuild = -not (Test-Path $dist)
    if (-not $needBuild) {
        # Enumerazione .NET diretta: Get-ChildItem è molto lento nelle cartelle di OneDrive.
        $built = [System.IO.File]::GetLastWriteTime($dist)
        foreach ($p in @('src', 'public', 'index.html', 'vite.config.ts', 'package.json') | ForEach-Object { Join-Path $root $_ }) {
            $files = if ([System.IO.Directory]::Exists($p)) { [System.IO.Directory]::EnumerateFiles($p, '*', 'AllDirectories') } else { @($p) }
            foreach ($f in $files) {
                if ([System.IO.File]::GetLastWriteTime($f) -gt $built) { $needBuild = $true; break }
            }
            if ($needBuild) { break }
        }
    }
    if ($needBuild) {
        Show-Splash 'Preparo l''app…'
        Stop-Server  # il server serve i file della build precedente
        Run-Hidden $node @('node_modules/vite/bin/vite.js', 'build')
    }

    if (-not (Test-Server)) {
        Show-Splash 'Avvio…'
        Stop-Server
        Start-Process -FilePath $node -ArgumentList @('node_modules/vite/bin/vite.js', 'preview') -WorkingDirectory $root -WindowStyle Hidden
        $deadline = (Get-Date).AddSeconds(30)
        while (-not (Test-Server)) {
            if ((Get-Date) -gt $deadline) { throw 'Il server locale non risponde.' }
            [System.Windows.Forms.Application]::DoEvents()
            Start-Sleep -Milliseconds 300
        }
    }

    $browser = Find-Browser
    if ($browser) {
        Start-Process -FilePath $browser -ArgumentList @("--app=$url", '--window-size=1360,900')
    } else {
        Start-Process $url
    }
} catch {
    [System.Windows.Forms.MessageBox]::Show("EasyChess non è riuscito ad avviarsi:`n`n$($_.Exception.Message)", 'EasyChess', 'OK', 'Error') | Out-Null
} finally {
    if ($splash) { $splash.Close() }
}
