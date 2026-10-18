@echo off
echo ========================================
echo Building and Deploying to GitHub Pages
echo ========================================
echo.

echo Step 1: Building the app...
call npm run build
if %errorlevel% neq 0 (
    echo Build failed!
    exit /b 1
)
echo Build successful!
echo.

echo Step 2: Deploying to GitHub Pages...
call npm run deploy
if %errorlevel% neq 0 (
    echo Deploy failed!
    exit /b 1
)
echo Deploy successful!
echo.

echo Step 3: Committing changes...
git add .
git commit -m "Auto-deploy: Update production build"
if %errorlevel% neq 0 (
    echo No changes to commit or commit failed!
)
echo.

echo Step 4: Pushing to GitHub...
git push origin main
if %errorlevel% neq 0 (
    echo Push failed!
    exit /b 1
)
echo.

echo ========================================
echo Deployment Complete!
echo Your site is live at:
echo https://muzammilahmed171.github.io/TutionManagementStytem-TMS/
echo ========================================
pause
