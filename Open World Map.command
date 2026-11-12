#!/bin/zsh
# Double-click to start the game and open it in your browser.
# Close this window (or press Ctrl+C) to stop it.
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
npm run dev
