@echo off
set "ROOT=%~dp0"
set "HF_ENDPOINT=https://hf-mirror.com"
set "HF_HOME=%ROOT%hf-cache"
"%ROOT%\.conda\python.exe" -m maia3.uci --model maia3-23m --cache-dir "%ROOT%hf-cache" --local-files-only --device cpu --no-use-amp %*
