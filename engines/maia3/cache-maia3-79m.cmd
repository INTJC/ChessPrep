@echo off
set "ROOT=%~dp0"
set "HF_ENDPOINT=https://hf-mirror.com"
set "HF_HOME=%ROOT%hf-cache"
if not exist "%ROOT%hf-cache" mkdir "%ROOT%hf-cache"
"%ROOT%\.conda\python.exe" -m maia3.cache --model maia3-79m --cache-dir "%ROOT%hf-cache"
