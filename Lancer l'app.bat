@echo off
title Carte42 - Demo velo SMMAG
cd /d "%~dp0"

if not exist "node_modules" (
    echo Installation des dependances npm...
    npm install
)

echo.
echo  ==========================================
echo   Carte 42 - Temps de parcours a velo
echo   Demonstrateur SMMAG 2026-FCS-SMAG-0138
echo  ==========================================
echo.
echo  Fermer cette fenetre arrete le serveur.
echo.

start /b cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:5176"
npm run dev
