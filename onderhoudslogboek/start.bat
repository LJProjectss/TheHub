@echo off
cd /d "%~dp0"
echo Afhankelijkheden controleren...
call npm install
call npm start
