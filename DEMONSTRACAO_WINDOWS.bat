@echo off
cd /d "%~dp0"
set "SKINAO_DB=%~dp0data\demonstracao.sqlite3"
echo DEMONSTRACAO - produtos e precos ficticios, banco separado.
echo A senha do primeiro acesso sera exibida nesta janela.
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 server.py --demo --open-browser
) else (
  python server.py --demo --open-browser
)
pause
