#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${VERSION:-1.0.0}"
DIST_DIR="${ROOT_DIR}/dist/macos"
PACKAGE_NAME="ChessPrep-Lab-macOS-${VERSION}"
PACKAGE_DIR="${DIST_DIR}/${PACKAGE_NAME}"
ZIP_PATH="${DIST_DIR}/${PACKAGE_NAME}.zip"

rm -rf "${PACKAGE_DIR}" "${ZIP_PATH}"
mkdir -p "${PACKAGE_DIR}"

copy_item() {
  local item="$1"
  if [[ -e "${ROOT_DIR}/${item}" ]]; then
    mkdir -p "${PACKAGE_DIR}/$(dirname "${item}")"
    cp -R "${ROOT_DIR}/${item}" "${PACKAGE_DIR}/${item}"
  fi
}

for item in \
  app.js \
  index.html \
  styles.css \
  server.mjs \
  endgames.js \
  endgame-expansion-lessons.js \
  engine-profiles.mjs \
  i18n.js \
  start-macos.sh \
  README.md \
  README-macOS.md \
  LICENSE \
  THIRD_PARTY_NOTICES.md \
  assets \
  data/player-prep/chinese-player-pinyin.json \
  engines/README.md \
  engines/maia3/default-model.txt \
  engines/maia3/maia3-uci.cmd \
  tools/player-prep \
  tools/engine-calibration; do
  copy_item "${item}"
done

chmod +x "${PACKAGE_DIR}/start-macos.sh"

(
  cd "${DIST_DIR}"
  zip -qry "${ZIP_PATH}" "${PACKAGE_NAME}"
)

echo "Created ${ZIP_PATH}"
