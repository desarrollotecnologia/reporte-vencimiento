' Inicia el bot sin mostrar ninguna ventana (usado por el autoinicio)
Set sh = CreateObject("WScript.Shell")
botDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run "cmd /c """ & botDir & "\iniciar-bot-reportes.bat"" silent", 0, False
