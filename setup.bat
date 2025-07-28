@echo off
REM =============================================================================
REM PROJECT INVOICE MANAGEMENT SYSTEM - QUICK SETUP SCRIPT (Windows)
REM =============================================================================

echo 🚀 Project Invoice Management System - Quick Setup
echo ==================================================

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js is installed: 
node --version

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm
    pause
    exit /b 1
)

echo ✅ npm is installed: 
npm --version

echo.
echo ℹ️  Setting up environment files...

REM Create backend environment file
if not exist "backend\.env" (
    copy "backend\.env.example" "backend\.env" >nul
    echo ✅ Created backend\.env from template
    echo ⚠️  Please edit backend\.env with your actual configuration values
) else (
    echo ⚠️  backend\.env already exists, skipping...
)

REM Create frontend environment file
if not exist "frontend\.env" (
    copy "frontend\.env.example" "frontend\.env" >nul
    echo ✅ Created frontend\.env from template
    echo ⚠️  Please edit frontend\.env with your actual configuration values
) else (
    echo ⚠️  frontend\.env already exists, skipping...
)

echo.
echo ℹ️  Installing dependencies...

REM Install backend dependencies
echo ℹ️  Installing backend dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install backend dependencies
    pause
    exit /b 1
)
cd ..
echo ✅ Backend dependencies installed

REM Install frontend dependencies
echo ℹ️  Installing frontend dependencies...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install frontend dependencies
    pause
    exit /b 1
)
cd ..
echo ✅ Frontend dependencies installed

REM Install documentation dependencies (optional)
if exist "docs" (
    echo ℹ️  Installing documentation dependencies...
    cd docs
    call npm install
    cd ..
    echo ✅ Documentation dependencies installed
)

echo.
echo ℹ️  Creating project structure...

REM Create necessary directories
if not exist "backend\uploads" mkdir "backend\uploads"
if not exist "backend\logs" mkdir "backend\logs"
if not exist "backend\backups" mkdir "backend\backups"

echo ✅ Project directories created

echo.
echo 🎉 Setup completed successfully!
echo ================================
echo.
echo ℹ️  Next steps:
echo.
echo 1. 📝 Configure your environment variables:
echo    - Edit backend\.env with your Google Sheets API credentials
echo    - Edit backend\.env with your payment gateway keys
echo    - Edit backend\.env with your email service configuration
echo    - Edit frontend\.env with your public API keys
echo.
echo 2. 📚 Read the detailed setup guide:
echo    - Open ENVIRONMENT_SETUP_GUIDE.md for detailed instructions
echo.
echo 3. 🗄️  Set up Google Sheets:
echo    - Create a Google Cloud Project
echo    - Enable Google Sheets API and Google Drive API
echo    - Create a service account and download the JSON key
echo    - Create a Google Sheets spreadsheet and share it with the service account
echo.
echo 4. 🚀 Start the application:
echo    - Backend: cd backend ^&^& npm run dev
echo    - Frontend: cd frontend ^&^& npm start
echo.
echo 5. 🧪 Test the setup:
echo    - Backend: cd backend ^&^& npm test
echo    - Frontend: cd frontend ^&^& npm test
echo.
echo ⚠️  Important: Make sure to configure all environment variables before starting the application!
echo.
echo ℹ️  For detailed setup instructions, see: ENVIRONMENT_SETUP_GUIDE.md
echo ℹ️  For troubleshooting, see: docs\docs\user-guide\system-testing-guide.md

pause