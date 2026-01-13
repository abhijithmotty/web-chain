#!/bin/bash

# LuxWatch Setup Script
# Quick installer for the vulnerable web application

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   🚨 LuxWatch - Vulnerable Web Application Setup 🚨      ║"
echo "║                                                           ║"
echo "║   WARNING: This application is INTENTIONALLY VULNERABLE   ║"
echo "║   For educational purposes ONLY!                          ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    echo ""
    echo "Or use Docker instead:"
    echo "  docker-compose up -d"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed!"
    echo "Please install npm or use Docker:"
    echo "  docker-compose up -d"
    exit 1
fi

echo "✅ npm found: $(npm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies!"
    exit 1
fi

echo "✅ Dependencies installed successfully!"
echo ""

# Create uploads directory
mkdir -p public/uploads

# Start the application
echo "🚀 Starting LuxWatch application..."
echo ""
echo "The application will be available at:"
echo "  👉 http://localhost:3000"
echo ""
echo "Default Admin Credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "Default User Credentials:"
echo "  Username: user"
echo "  Password: user123"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""
echo "Starting in 3 seconds..."
sleep 3

npm start
