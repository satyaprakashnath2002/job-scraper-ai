# Start the Job Scraper backend (run this and keep the window open)
Set-Location $PSScriptRoot
& .\venv\Scripts\Activate.ps1
Write-Host "Starting backend at http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "Open http://127.0.0.1:8000 in browser to check. Press Ctrl+C to stop." -ForegroundColor Yellow
uvicorn main:app --reload --host 127.0.0.1 --port 8000
