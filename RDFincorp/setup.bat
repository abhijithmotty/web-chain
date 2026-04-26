@echo off
echo Setting up RDFincorp (Windows)...

echo 1. Installing dependencies...
call npm install

echo 2. Initializing the database...
call npm run init-db

echo Setup complete! You can now start the server by running:
echo npm start
pause
