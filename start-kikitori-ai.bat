@echo off
cd /d "%~dp0"
echo ========================================
echo Kikitori AI local launcher
echo ========================================
echo.
echo 1. Paste your OpenAI API key and press Enter.
echo 2. Keep this black window open.
echo 3. The browser opens after the server starts.
echo.
set /p OPENAI_API_KEY=API key: 
if "%OPENAI_API_KEY%"=="" (
  echo API key is empty.
  pause
  exit /b 1
)
set "NODE_EXE="
where node >nul 2>nul && set "NODE_EXE=node"
if not defined NODE_EXE if exist "C:\Users\iwanami5\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NODE_EXE=C:\Users\iwanami5\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined NODE_EXE (
  echo Node.js was not found.
  echo Please install Node.js, or open this project from Codex again.
  pause
  exit /b 1
)
set PORT=4173
set HOST=127.0.0.1
set AUTO_OPEN=1
echo.
echo Starting Kikitori AI server...
echo If the browser does not open, use this URL:
echo http://127.0.0.1:4173/index.html?v=16
echo.
"%NODE_EXE%" server.js
echo.
echo Server stopped.
pause
