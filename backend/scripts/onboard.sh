#!/bin/bash
# Onboarding script: creates the folder structure for a new intern.
# Usage: onboard.sh <intern-name> [data-dir]
name="$1"; data="${2:-data}"
[ -z "$name" ] && { echo "usage: onboard.sh <intern-name> [data-dir]"; exit 1; }
dir="$data/interns/$name"
mkdir -p "$dir"
chmod 700 "$dir"                       # only the owner may enter the folder
echo "Joined on: $(date '+%d/%m/%Y %H:%M')" > "$dir/profile.txt"
echo "Onboarded intern '$name' -> $dir"
