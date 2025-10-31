@echo off
echo Starting Booking Swap Platform...
echo.

echo Starting Backend Server...
start "Backend" cmd /k "cd apps\backend && npm run dev"

timeout /t 3 /nobreak > nul

echo Starting Frontend Server...
start "Frontend" cmd /k "cd apps\frontend && npm run dev"

echo.
echo Both servers are starting...
echo Backend: http://localhost:3001
echo Frontend: http://localhost:3000
echo.
pause