@echo off
set "ROOT=%~dp0"
set "HF_ENDPOINT=https://hf-mirror.com"
set "HF_HOME=%ROOT%hf-cache"
if not defined MAIA3_MODEL if exist "%ROOT%default-model.txt" set /p MAIA3_MODEL=<"%ROOT%default-model.txt"
if not defined MAIA3_MODEL set "MAIA3_MODEL=maia3-23m"
"%ROOT%\.conda\python.exe" -m maia3.uci --model "%MAIA3_MODEL%" --cache-dir "%ROOT%hf-cache" --local-files-only --device cpu --no-use-amp %*
