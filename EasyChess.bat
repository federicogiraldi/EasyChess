@echo off
title EasyChess
cd /d "%~dp0"
if not exist node_modules (
  echo Installazione dipendenze...
  call npm install
)
call npm start
