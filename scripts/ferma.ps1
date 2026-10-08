# Ferma il server locale di EasyChess (porta 5317), che resta attivo in background dopo l'avvio.
Get-NetTCPConnection -LocalPort 5317 -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Write-Output 'Server di EasyChess fermato.'
