' Avvia EasyChess in una finestra dedicata, senza console visibili (vedi scripts\avvia.ps1).
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & dir & "\scripts\avvia.ps1""", 0, False
