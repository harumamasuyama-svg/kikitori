@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo キキトリ AI連携版を起動します
echo ========================================
echo.
echo OpenAIのAPIキーを貼り付けて Enter を押してください。
echo 例: sk-から始まる長い文字列です。
echo この画面で入力したキーはファイルには保存されません。
echo.
set /p OPENAI_API_KEY=APIキー: 
if "%OPENAI_API_KEY%"=="" (
  echo.
  echo APIキーが空です。何もせず終了します。
  pause
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js が見つかりません。
  echo 先に Node.js をインストールする必要があります。
  pause
  exit /b 1
)
set PORT=4173
set HOST=127.0.0.1
echo.
echo ブラウザを開きます...
start "" "http://127.0.0.1:4173/index.html?v=13"
echo.
echo この黒い画面は閉じないでください。閉じるとAI清書も止まります。
echo.
node server.js
pause
