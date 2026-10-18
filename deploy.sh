#!/bin/bash

echo "========================================"
echo "Building and Deploying to GitHub Pages"
echo "========================================"
echo ""

echo "Step 1: Building the app..."
npm run build
if [ $? -ne 0 ]; then
    echo "Build failed!"
    exit 1
fi
echo "Build successful!"
echo ""

echo "Step 2: Deploying to GitHub Pages..."
npm run deploy
if [ $? -ne 0 ]; then
    echo "Deploy failed!"
    exit 1
fi
echo "Deploy successful!"
echo ""

echo "Step 3: Committing changes..."
git add .
git commit -m "Auto-deploy: Update production build"
if [ $? -ne 0 ]; then
    echo "No changes to commit or commit failed!"
fi
echo ""

echo "Step 4: Pushing to GitHub..."
git push origin main
if [ $? -ne 0 ]; then
    echo "Push failed!"
    exit 1
fi
echo ""

echo "========================================"
echo "Deployment Complete!"
echo "Your site is live at:"
echo "https://muzammilahmed171.github.io/TutionManagementStytem-TMS/"
echo "========================================"
