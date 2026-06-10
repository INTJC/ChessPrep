ChessPrep Lab - Full Offline Windows Installer

Recommended install:
1. Double-click dist\installer\ChessPrep-Lab-Setup.exe.
2. Keep the default no-admin install path.
3. Let the setup wizard finish, then launch ChessPrep Lab.

Fallback ZIP install:
1. Extract this ZIP file.
2. Double-click 一键安装.bat.
3. If Windows asks for confirmation, allow it.

What the installer does:
- Copies the trainer to %LOCALAPPDATA%\ChessPrep Lab
- Creates a desktop shortcut named "ChessPrep Lab"
- Uses the bundled Node.js runtime
- Includes Stockfish for engine training
- Includes Maia-3 23M with its bundled Python runtime and local model cache

After installation:
- Double-click the desktop shortcut to open the trainer in your browser.

Notes:
- Internet is needed only for public Lichess study URL import.
- Private Lichess studies should be imported by PGN paste or .pgn upload.
- Your saved studies are browser-local data and are not included in this installer.
