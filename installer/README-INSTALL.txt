ChessPrep Lab - Full Offline Windows Installer

License and source:
- ChessPrep Lab is licensed under GNU AGPL v3.0.
- Every installer must include LICENSE and THIRD_PARTY_NOTICES.md.
- Recipients must be given access to the matching corresponding source.
- Stockfish and Maia-3 remain under their respective copyleft licenses.
- Maia-3 software and the bundled 23M/79M model weights use GNU AGPL v3.0.

Recommended install:
1. Choose ChessPrep-Lab-Setup.exe (Maia-3 23M) or ChessPrep-Lab-Maia3-79M-Setup.exe.
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
- Includes one Maia-3 model with its bundled Python runtime and local cache
- The standard installer defaults to 23M; the 79M installer defaults to 79M

After installation:
- Double-click the desktop shortcut to open the trainer in your browser.

Notes:
- Internet is needed only for public Lichess study URL import.
- Private Lichess studies should be imported by PGN paste or .pgn upload.
- Your saved studies are browser-local data and are not included in this installer.
