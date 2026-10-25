@echo off
if not exist out mkdir out
javac -d out src\vims\*.java || exit /b 1
java -cp out vims.Main %1
