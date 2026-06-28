@echo off
cd /d "%~dp0"
echo ========================================
echo Kikitori AI local launcher
echo ========================================
echo.
echo Paste your OpenAI API key and press Enter.
echo It starts with sk- .
echo This key is NOT saved to a file.
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
echo.
echo Opening browser...
start "" "http://127.0.0.1:4173/index.html?v=13"
echo.
echo Keep this window open while using AI polish.
echo Close this window to stop the local AI server.
echo.
"%NODE_EXE%" server.js
pause
