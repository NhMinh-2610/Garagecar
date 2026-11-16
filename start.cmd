@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo Chua co moi truong Python .venv. Chay cac lenh sau tai thu muc project:
    echo python -m venv .venv
    echo .venv\Scripts\python.exe -m pip install -r be\requirements.txt
    exit /b 1
)
cd be
"..\.venv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8000 %*
exit /b %errorlevel%
