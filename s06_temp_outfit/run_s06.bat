@echo off
chcp 950 >nul
cd /d "%~dp0"
python pipeline.py
