# Genera le icone di EasyChess: PNG per la PWA (public/icons) e l'icona .ico del collegamento (assets).
# Uso: powershell -ExecutionPolicy Bypass -File scripts\genera-icone.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot

# Cavallo bianco su sfondo color legno. $inset > 0 lascia margine (icone "maskable", che il sistema ritaglia).
function New-Icon([int]$size, [double]$inset, [bool]$rounded) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.TextRenderingHint = 'AntiAliasGridFit'
    $g.Clear([System.Drawing.Color]::Transparent)

    $top = New-Object System.Drawing.Point 0, 0
    $bottom = New-Object System.Drawing.Point 0, $size
    $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $top, $bottom, ([System.Drawing.Color]::FromArgb(217, 138, 61)), ([System.Drawing.Color]::FromArgb(156, 84, 22))
    if ($rounded) {
        $r = [int]($size * 0.22)
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddArc(0, 0, $r, $r, 180, 90)
        $path.AddArc($size - $r - 1, 0, $r, $r, 270, 90)
        $path.AddArc($size - $r - 1, $size - $r - 1, $r, $r, 0, 90)
        $path.AddArc(0, $size - $r - 1, $r, $r, 90, 90)
        $path.CloseFigure()
        $g.FillPath($bg, $path)
    } else {
        $g.FillRectangle($bg, 0, 0, $size, $size)
    }

    $glyph = $size * 0.9 * (1 - 2 * $inset)
    $font = New-Object System.Drawing.Font 'Segoe UI Symbol', ([float]$glyph), ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = 'Center'
    $fmt.LineAlignment = 'Center'
    $rect = New-Object System.Drawing.RectangleF 0, ([float]($size * 0.055)), $size, $size
    $g.DrawString([string][char]0x265E, $font, [System.Drawing.Brushes]::White, $rect, $fmt)
    $g.Dispose()
    return $bmp
}

function Save-Png($bmp, $file) {
    New-Item -ItemType Directory -Force (Split-Path $file) | Out-Null
    $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

Save-Png (New-Icon 192 0 $true) (Join-Path $root 'public\icons\icon-192.png')
Save-Png (New-Icon 512 0 $true) (Join-Path $root 'public\icons\icon-512.png')
Save-Png (New-Icon 512 0.12 $false) (Join-Path $root 'public\icons\maskable-512.png')
Save-Png (New-Icon 180 0.06 $false) (Join-Path $root 'public\icons\apple-touch-icon.png')

# .ico con un'unica immagine PNG 256x256 (supportata da Windows Vista in poi).
$bmp = New-Icon 256 0 $true
$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$png = $ms.ToArray()
$ico = Join-Path $root 'assets\easychess.ico'
New-Item -ItemType Directory -Force (Split-Path $ico) | Out-Null
$w = New-Object System.IO.BinaryWriter ([System.IO.File]::Create($ico))
$w.Write([UInt16]0); $w.Write([UInt16]1); $w.Write([UInt16]1)
$w.Write([Byte]0); $w.Write([Byte]0); $w.Write([Byte]0); $w.Write([Byte]0)
$w.Write([UInt16]1); $w.Write([UInt16]32)
$w.Write([UInt32]$png.Length); $w.Write([UInt32]22)
$w.Write($png)
$w.Close()

Write-Output 'Icone generate in public\icons e assets\easychess.ico'
