#!/bin/bash
echo "Setting up RDFincorp (Linux/macOS)..."

echo "1. Installing dependencies..."
npm install

echo "2. Initializing the database..."
npm run init-db

echo "Setup complete! You can now start the server by running:"
echo "npm start"
