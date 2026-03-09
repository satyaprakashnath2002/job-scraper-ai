@echo off
cd /d "%~dp0"
call venv\Scripts\activate.bat
echo Starting backend at http://127.0.0.1:8000
echo Open http://127.0.0.1:8000 in browser to check. Press Ctrl+C to stop.
uvicorn main:app --reload --host 127.0.0.1 --port 8000
pause
