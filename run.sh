#!/bin/bash
# Compile and run the Virtual Internship Management System.
# Usage: ./run.sh [port]      then open http://localhost:8081
mkdir -p out
javac -d out src/vims/*.java || exit 1
java -cp out vims.Main "${1:-8081}"
