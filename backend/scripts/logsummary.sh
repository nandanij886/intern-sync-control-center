#!/bin/bash
# Log summary script: counts the important events written by the platform.
# Usage: logsummary.sh [data-dir]
log="${1:-data}/logs/system.log"
[ -f "$log" ] || { echo "no log file yet"; exit 0; }
for ev in LOGIN ADMIT DISPATCH "PAGE FAULT" INTERRUPT URGENT AUTOSAVE PLAGIARISM SUBMITTED "BANKER refused"; do
  printf "%-16s %s\n" "$ev" "$(grep -c "$ev" "$log")"
done
