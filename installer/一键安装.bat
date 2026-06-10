@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-LichessTrainer.ps1"
if errorlevel 1 (
  echo.
  echo 安装失败。请把窗口里的错误信息发给开发者。
  pause
  exit /b 1
)
echo.
echo 安装完成。桌面上已经创建 “ChessPrep Lab” 快捷方式。
pause
