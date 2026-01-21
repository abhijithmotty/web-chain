# Docker Deployment Guide for RDFincorp

**A Beginner-Friendly Guide to Understanding and Deploying with Docker**

---

## 🐳 What is Docker?

Think of Docker as a **shipping container for your application**. Just like shipping containers:
- They package everything needed inside
- They work the same way anywhere (your computer, server, cloud)
- They're isolated from other containers
- They can be easily moved and shared

### Why Use Docker?

✅ **"It works on my machine"** - With Docker, it works on ANY machine  
✅ **No dependency hell** - Everything your app needs is packaged inside  
✅ **Easy deployment** - Build once, run anywhere  
✅ **Isolation** - Won't conflict with other apps on the same machine

---

## 📦 Understanding Docker Components

### 1. **Dockerfile** - The Recipe
This file tells Docker **how to build** your application container.

```dockerfile
FROM node:18-alpine          # Start with Node.js base image
WORKDIR /app                 # Set working directory
COPY package*.json ./        # Copy dependency files
RUN npm install              # Install dependencies
COPY . .                     # Copy all application files
RUN node init-db.js          # Initialize database
EXPOSE 3000                  # Expose port 3000
CMD ["node", "server.js"]    # Command to start app
```

**Think of it as**: A recipe that says "Start with this base, add these ingredients, cook this way"

### 2. **docker-compose.yml** - The Orchestrator
This file makes running Docker containers **easy** with simple commands.

```yaml
services:
  rdfincorp:                      # Service name
    build: .                      # Build from Dockerfile in current directory
    container_name: rdfincorp_banking  # Container name
    ports:
      - "3000:3000"              # Map port 3000 inside to 3000 outside
    volumes:
      - ./database:/app/database  # Persist database data
    environment:
      - NODE_ENV=development     # Set environment variables
```

**Think of it as**: A configuration file that says "Here's how to run this container"

### 3. **Image** - The Blueprint
Created from your Dockerfile. It's like a frozen snapshot of your application.

### 4. **Container** - The Running Instance
The actual running application created from an image. Like launching a program from an installer.

---

## 🚀 Step-by-Step Deployment Guide

### Prerequisites

**1. Install Docker**
```bash
# On Ubuntu/Debian
sudo apt update
sudo apt install docker.io docker-compose

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add your user to docker group (optional, to avoid using sudo)
sudo usermod -aG docker $USER
# Then logout and login again
```

**2. Verify Installation**
```bash
docker --version
docker-compose --version
```

---

## 📖 Teaching Guide: Deploy RDFincorp Step-by-Step

### **Step 1: Navigate to Project Directory**
```bash
cd /home/aetheron/Rteamhackeracademy/web-chain
```

**What's happening?** You're going to the folder containing all application files.

---

### **Step 2: Build the Docker Image**
```bash
sudo docker-compose build
```

**What's happening?**
- Docker reads `Dockerfile`
- Downloads Node.js base image (if not already downloaded)
- Installs npm packages (`express`, `ejs`, `sqlite3`, etc.)
- Copies your application code
- Creates database and seed data
- Creates a complete image with everything needed

**You'll see:**
```
[+] Building 38.7s (11/11) FINISHED
```

**Time**: ~30-40 seconds first time, faster on rebuilds (uses cache)

---

### **Step 3: Start the Application**
```bash
sudo docker-compose up -d
```

**What's happening?**
- Creates a network for containers to communicate
- Starts container from the image
- Maps port 3000 (container) → 3000 (your computer)
- Runs in background (`-d` = detached mode)

**You'll see:**
```
✔ Network web-chain_rdfincorp_network  Created
✔ Container rdfincorp_banking          Started
```

---

### **Step 4: Verify It's Running**
```bash
# Check container status
sudo docker-compose ps

# View logs
sudo docker-compose logs

# Test with curl
curl http://localhost:3000
```

**You should see:**
```
RDFincorp Banking Application running on http://localhost:3000
⚠️  WARNING: This application is INTENTIONALLY VULNERABLE
Connected to SQLite database
```

---

### **Step 5: Access the Application**
```bash
# Open in browser
http://localhost:3000
```

**Login with:**
- Email: `admin@rdfincorp.com`
- Password: `admin123`

---

## 🔧 Common Docker Commands

### Managing Containers

```bash
# View running containers
sudo docker-compose ps
sudo docker ps

# View all containers (including stopped)
sudo docker ps -a

# Stop the application
sudo docker-compose down

# Restart the application
sudo docker-compose restart

# View real-time logs
sudo docker-compose logs -f

# Stop following logs (Ctrl+C)
```

### Rebuilding

```bash
# Rebuild and restart (after code changes)
sudo docker-compose up -d --build

# Force rebuild without cache
sudo docker-compose build --no-cache
```

### Cleaning Up

```bash
# Remove container
sudo docker-compose down

# Remove container and volumes (deletes database!)
sudo docker-compose down -v

# Remove unused images
sudo docker image prune

# Remove everything Docker (careful!)
sudo docker system prune -a
```

---

## 🐛 The Issue We Fixed

### **What Was the Problem?**

In the initial `init-db.js`, we had this pattern:

```javascript
db.serialize(() => {
    // Create users and data
    setTimeout(() => { /* Insert transactions */ }, 500);
    setTimeout(() => { /* Insert loans */ }, 600);
});

db.close(() => {  // ❌ Closed too early!
    console.log('Done!');
});
```

**The Problem:**
- `db.serialize()` completes
- `db.close()` is called immediately
- Database closes BEFORE `setTimeout` callbacks run
- When callbacks try to insert data → **SQLITE_MISUSE: Database handle is closed**

### **The Fix:**

```javascript
db.serialize(() => {
    // Create users
    
    setTimeout(() => {
        // Insert transactions
        
        // Insert loans (nested)
        db.run('INSERT INTO loans...', (err) => {
            // Only close AFTER all operations complete
            db.close(() => {
                console.log('Done!');
                process.exit(0);  // ✅ Exit cleanly
            });
        });
    }, 1000);
});

// ❌ Removed early db.close()
```

**Why it works now:**
- All operations complete in nested callbacks
- Database only closes after final insertion
- `process.exit(0)` ensures clean exit

---

## 📚 Teaching Others: Simple Explanation

### **The Story Analogy**

**Without Docker:**
> "To run this app, you need Node.js version 18, install these 6 packages, set up SQLite, create this folder structure, initialize the database..."

**Student:** "It doesn't work on my computer! I have Node 20 and different SQLite version!"

**With Docker:**
> "Run `docker-compose up` - done!"

**Student:** "It works perfectly!"

### **Visual Explanation**

```
┌─────────────────────────────────────┐
│          Docker Container           │
│  ┌───────────────────────────────┐  │
│  │   RDFincorp Application       │  │
│  │   - Node.js 18                │  │
│  │   - Express server            │  │
│  │   - SQLite database           │  │
│  │   - All dependencies          │  │
│  └───────────────────────────────┘  │
│                                     │
│  Port 3000 → Outside Port 3000     │
└─────────────────────────────────────┘
         ↓
    Your Computer
    (any OS, any setup)
```

---

## 🎓 Teaching Checklist

When teaching Docker deployment:

### **1. Explain the Concept (5 min)**
- [ ] Containers vs traditional deployment
- [ ] "Works on my machine" problem
- [ ] Docker as shipping containers

### **2. Show the Files (5 min)**
- [ ] Walk through `Dockerfile` line by line
- [ ] Explain `docker-compose.yml` structure
- [ ] Show `.dockerignore`

### **3. Live Demo (10 min)**
- [ ] Run `docker-compose build` - explain what's happening
- [ ] Run `docker-compose up -d` - show it starting
- [ ] Show `docker ps` - container is running
- [ ] Open in browser - it works!
- [ ] Show `docker-compose logs` - what's logging

### **4. Practice Commands (10 min)**
- [ ] Stop: `docker-compose down`
- [ ] Start: `docker-compose up -d`
- [ ] Logs: `docker-compose logs -f`
- [ ] Restart: `docker-compose restart`

### **5. Troubleshooting (5 min)**
- [ ] Port conflicts
- [ ] Permission issues (sudo)
- [ ] Viewing errors in logs

---

## 🎯 Quick Reference Card

```bash
# BUILD
docker-compose build              # Build image

# START/STOP
docker-compose up -d              # Start in background
docker-compose down               # Stop and remove
docker-compose restart            # Restart

# MONITOR
docker-compose ps                 # Status
docker-compose logs               # View logs
docker-compose logs -f            # Follow logs

# REBUILD
docker-compose up -d --build      # Rebuild and start
```

---

## 💡 Pro Tips

1. **Always use `docker-compose`** instead of raw `docker` commands (easier)
2. **Use `-d` flag** to run in background (detached mode)
3. **Check logs** when something doesn't work: `docker-compose logs`
4. **Volumes persist data** - your database survives container restarts
5. **Rebuild after code changes** - use `--build` flag

---

## 🚨 Common Issues & Solutions

### Issue: "Permission denied"
```bash
# Solution 1: Use sudo
sudo docker-compose up -d

# Solution 2: Add user to docker group
sudo usermod -aG docker $USER
# Logout and login again
```

### Issue: "Port 3000 already in use"
```bash
# Find what's using port 3000
sudo lsof -i :3000

# Kill it or change port in docker-compose.yml
```

### Issue: "Container won't start"
```bash
# Check logs for errors
sudo docker-compose logs

# Rebuild without cache
sudo docker-compose build --no-cache
```

### Issue: "Changes not appearing"
```bash
# Rebuild the image
sudo docker-compose up -d --build
```

---

## ✅ Success Indicators

Your deployment is successful when:

✅ `docker-compose build` completes without errors  
✅ `docker-compose up -d` shows "Started"  
✅ `docker-compose ps` shows container as "Up"  
✅ `curl http://localhost:3000` returns HTTP 302  
✅ Browser shows login page at `http://localhost:3000`  
✅ Admin login works: `admin@rdfincorp.com` / `admin123`

---

**Now you can confidently deploy and teach Docker! 🐳**
