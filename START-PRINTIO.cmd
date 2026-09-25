@echo off
cd /d "%~dp0"
echo Printio: http://localhost:3000
echo Admin: http://localhost:3000/admin
node --env-file-if-exists=.env server.mjs
pause
