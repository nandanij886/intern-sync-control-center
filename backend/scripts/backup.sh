#!/bin/bash
# Backup script: archives all intern records with a timestamp and keeps the last 5 backups.
# Usage: backup.sh [data-dir]
data="${1:-data}"
mkdir -p backups
file="backups/interns_$(date +%Y%m%d_%H%M%S).tar.gz"
if [ ! -d "$data/interns" ]; then echo "nothing to back up yet"; exit 0; fi
tar -czf "$file" -C "$data" interns
ls -1t backups/interns_*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm --   # delete old backups
echo "Backup created: $file ($(ls backups | wc -l) kept)"
