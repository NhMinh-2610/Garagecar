@echo off
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" scripts\run.py uvicorn main:app --host 127.0.0.1 --port 8000
    exit /b
)
rem Use the existing pgAdmin Python runtime with project-local libraries.
if exist ".venv\Lib\site-packages\fastapi" (
    for /d %%D in ("%ProgramFiles%\PostgreSQL\*") do (
        if exist "%%~D\pgAdmin 4\python\python.exe" (
            "%%~D\pgAdmin 4\python\python.exe" scripts\run.py uvicorn main:app --host 127.0.0.1 --port 8000
            exit /b
        )
    )
)
python scripts\run.py uvicorn main:app --host 127.0.0.1 --port 8000
