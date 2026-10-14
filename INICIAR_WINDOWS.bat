@echo off
cd /d "%~dp0"
echo Skinao do Esporte - Gestao e catalogo
echo Mantenha esta janela aberta durante o uso.
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 server.py --open-browser
) else (
  python server.py --open-browser
)
pause
