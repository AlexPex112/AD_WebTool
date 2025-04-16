@echo off
setlocal enabledelayedexpansion

:: Set console colors and title
color 0B
title DB Web - Requirements Installer

:: Color functions
echo     ____  ____    _       __     __    
echo    / __ \/ __ )  ^| ^|     / /__  / /_   
echo   / / / / __  ^|  ^| ^| /^| / / _ \/ __ \  
echo  / /_/ / /_/ /   ^| ^|/ ^|/ /  __/ /_/ /  
echo /_____/_____/    ^|__/^|__/\___/_.___/   
echo.
echo  ========================================
echo          Requirements Installer
echo  ========================================
echo.

:: Check if Python is installed
python --version > nul 2>&1
call :colorecho "Python version: %python --version%" Green
echo.
if errorlevel 1 (
    call :colorecho "Error: Python is not installed or not in PATH" Red
    echo.
    echo Please install Python from https://www.python.org/downloads/
    pause
    exit /b 1
)

:: Check if pip is installed
python -m pip --version > nul 2>&1
call :colorecho "pip version: %pip_version%" Green
if errorlevel 1 (
    call :colorecho "Error: pip is not installed" Red
    echo.
    echo Installing pip...
    python -m ensurepip --default-pip
    if errorlevel 1 (
        call :colorecho "Failed to install pip" Red
        echo.
        pause
        exit /b 1
    )
)

:: Update pip to latest version
call :colorecho "Updating pip to latest version..." Cyan
echo.
python -m pip install --upgrade pip > nul 2>&1
call :colorecho "√ Pip updated successfully" Green
echo.

:: Function to check if a package is installed
set "packages=Flask Flask-Login Werkzeug Flask-SQLAlchemy SQLAlchemy mysql-connector-python"

echo.
call :colorecho "Checking and installing required packages..." Cyan
echo.
echo  ----------------------------------------

:: Install requirements
for %%p in (%packages%) do (
    call :colorecho "Checking %%p..." Cyan
    echo.
    python -m pip show %%p > nul 2>&1
    if errorlevel 1 (
        call :colorecho "   Installing %%p..." Yellow
        echo.
        python -m pip install %%p > nul 2>&1
        if errorlevel 1 (
            call :colorecho "Failed to install %%p" Red
            echo.
        ) else (
            call :colorecho "   √ %%p already installed" Green
            echo.
        )
    ) else (
        call :colorecho "   √ %%p already installed" Green
        echo.
    )
)

echo.
echo  ========================================
call :colorecho "Installation Complete!" Green
echo.
echo  ========================================
echo.
call :colorecho "You can now run the application using:" Cyan
echo.
echo  python app.py
echo.
pause
exit /b

:colorecho
set "param=^%~1"
set "param=!param:{=!"
set "param=!param:}=!"
powershell write-host -nonewline -foregroundcolor %~2 "!param!"
exit /b