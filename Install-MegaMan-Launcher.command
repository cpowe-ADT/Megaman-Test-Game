#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$HOME/Applications"
APP_PATH="$APP_DIR/MegaMan Dev Launcher.app"
OSA_TMP="$SCRIPT_DIR/.megaman_launcher.scpt"

mkdir -p "$APP_DIR"

cat > "$OSA_TMP" <<'APPLESCRIPT'
on run
  set projectPath to "__PROJECT_PATH__"
  tell application "Terminal"
    activate
    do script "cd " & quoted form of projectPath & " && ./Open-MegaMan-Dev.command"
  end tell
end run
APPLESCRIPT

python3 - <<'PY' "$OSA_TMP" "$SCRIPT_DIR"
from pathlib import Path
import sys
script = Path(sys.argv[1])
project = Path(sys.argv[2]).as_posix()
raw = script.read_text(encoding='utf-8')
script.write_text(raw.replace("__PROJECT_PATH__", project), encoding='utf-8')
PY

osacompile -o "$APP_PATH" "$OSA_TMP"
rm -f "$OSA_TMP"

PLIST_ENTRY="<dict><key>tile-data</key><dict><key>file-data</key><dict><key>_CFURLString</key><string>${APP_PATH}</string><key>_CFURLStringType</key><integer>0</integer></dict></dict><key>tile-type</key><string>file-tile</string></dict>"

if ! defaults read com.apple.dock persistent-apps 2>/dev/null | grep -Fq "$APP_PATH"; then
  defaults write com.apple.dock persistent-apps -array-add "$PLIST_ENTRY"
  killall Dock || true
fi

echo "Launcher installed at: $APP_PATH"
echo "If macOS blocked auto-pin, drag this app to the Dock manually."
