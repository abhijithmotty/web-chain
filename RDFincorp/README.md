# RDFincorp - Intentionally Vulnerable Banking Application

![Security Training](https://img.shields.io/badge/Purpose-Security%20Training-red)
![Status](https://img.shields.io/badge/Status-Intentionally%20Vulnerable-critical)

**RDFincorp** is a deliberately vulnerable banking application designed for security training, penetration testing practice, and web attack chain demonstrations.

> ⚠️ **WARNING**: This application contains severe security vulnerabilities by design. **NEVER** deploy to production or expose to the internet.

---

## 🚀 Quick Start

### Using Docker (Recommended)

```bash
# Clone and navigate
cd /path/to/web-chain

# Start the application
sudo docker-compose up -d --build

# Access at http://localhost:3000
```

### Manual Setup

```bash
# Install dependencies
npm install

# Initialize database
node init-db.js

# Start server
npm start
```

---

## 🔑 Default Accounts

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@rdfincorp.com | admin123 |
| **User** | john.doe@example.com | password123 |
| **User** | jane.smith@example.com | password456 |
| **User** | bob.wilson@example.com | password789 |

**SQL Injection Bypass**: `admin@rdfincorp.com' OR '1'='1' --`

---

## ✨ Features

### User Features
- Account dashboard with balance overview
- Credit card management (apply, view active cards)
- Loan applications with automatic disbursement on approval
- Money transfers between accounts
- Profile management (update name, email, password)
- Real-time loan approval notifications

### Admin Features
- User management dashboard
- Loan & credit card application approval/rejection
- Transaction monitoring
- **Create new users and admins**
- View all system data

---

## 🐛 Vulnerability Categories

This application contains **8 major vulnerability types**:

1. **SQL Injection** (Login bypass)
2. **Stored XSS** (Loan application purpose field)
3. **IDOR** (Access any user's data, transfer from any account)
4. **CSRF** (Profile updates, transfers, admin actions)
5. **Broken Access Control** (Weak admin checks, API authorization)
6. **Mass Assignment** (Update balance, credit score, admin status)
7. **Sensitive Data Exposure** (Plaintext passwords, exposed backup API)
8. **No Balance Validation** (Transfer funds you don't have, race conditions)

📚 **For detailed exploitation techniques**, see [`WALKTHROUGH.md`](./WALKTHROUGH.md)  
📋 **For complete vulnerability documentation**, see [`VULNERABILITIES.md`](./VULNERABILITIES.md)

---

## 🎯 Attack Chain Examples

**Chain 1: Complete Account Takeover**
```
SQLi → Admin Access → View All Users → IDOR Transfer → Profit
```

**Chain 2: Privilege Escalation**
```
Register → CSRF/Mass Assignment → Become Admin → Approve Own Applications
```

**Chain 3: Social Engineering + XSS**
```
Loan XSS Payload → Admin Views → Session Stolen → Full Compromise
```

**See [`WALKTHROUGH.md`](./WALKTHROUGH.md) for step-by-step instructions**

---

## 📁 Project Structure

```
web-chain/
├── server.js              # Main Express server
├── init-db.js             # Database initialization
├── routes/
│   ├── auth.js           # Login, registration (SQLi here)
│   ├── user.js           # User dashboard, applications, profile
│   ├── admin.js          # Admin panel, approvals, user creation
│   └── api.js            # API endpoints (IDOR everywhere)
├── views/                # EJS templates
│   ├── login.ejs
│   ├── dashboard.ejs
│   ├── profile.ejs       # NEW: Profile update page
│   ├── admin.ejs         # Admin panel with user creation
│   ├── apply-card.ejs
│   └── apply-loan.ejs
├── public/               # Static assets
│   ├── css/
│   └── js/
├── database/             # SQLite database
├── Dockerfile
├── docker-compose.yml
├── WALKTHROUGH.md        # Detailed attack scenarios
├── VULNERABILITIES.md    # Complete vulnerability documentation
└── DOCKER_GUIDE.md      # Docker deployment guide
```

---

## 🎓 Use Cases

✅ Security training workshops  
✅ Penetration testing practice  
✅ Web attack chain demonstrations  
✅ BurpSuite tutorial sessions  
✅ OWASP Top 10 education  
✅ Secure coding training (what NOT to do)

---

## 🛠️ Development

```bash
# View logs
sudo docker-compose logs -f

# Restart application
sudo docker-compose restart

# Stop application
sudo docker-compose down

# Rebuild from scratch
sudo docker-compose up -d --build --force-recreate
```

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [`WALKTHROUGH.md`](./WALKTHROUGH.md) | Step-by-step attack scenarios with BurpSuite |
| [`VULNERABILITIES.md`](./VULNERABILITIES.md) | Complete vulnerability catalog |
| [`DOCKER_GUIDE.md`](./DOCKER_GUIDE.md) | Docker deployment guide for beginners |

---

## ⚠️ Security Warnings

**This application is INTENTIONALLY INSECURE:**

- ❌ No password hashing (plaintext storage)
- ❌ No CSRF protection
- ❌ No input validation or sanitization
- ❌ No rate limiting
- ❌ SQL injection vulnerabilities
- ❌ Broken access control
- ❌ Sensitive data exposure
- ❌ No audit logging

**DO NOT:**
- Deploy to production
- Use real credentials
- Expose to the internet
- Use on networks with sensitive data

**USE ONLY:**
- In isolated environments
- For security training
- Behind firewall
- With dummy data only

---

## 🎯 Learning Objectives

By exploiting this application, you will learn:

- How SQL injection bypasses authentication
- IDOR exploitation techniques
- XSS payload crafting and delivery
- CSRF attack generation with BurpSuite
- Mass assignment vulnerabilities
- Attack chaining for maximum impact
- Privilege escalation methods
- Why input validation matters
- Importance of proper authentication
- Session management security

---

## 🤝 Contributing

This is an educational project. If you find additional vulnerabilities (intentional or bugs), feel free to open an issue or submit a PR.

---

## 📜 License

This project is for educational purposes only. Use responsibly.

---

## 🎤 Perfect for Webinars

This application was designed for security training webinars with:
- Clear vulnerability demonstrations
- Progressive attack complexity
- Real-world attack chaining scenarios
- Visual confirmation of exploits
- Easy to understand codebase

**Last Updated**: January 2026  
**Version**: 1.0 - Webinar Ready
