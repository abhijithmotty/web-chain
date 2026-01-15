# 🚨 LuxWatch - Intentionally Vulnerable Luxury Watch Shop 🚨

![WARNING](https://img.shields.io/badge/⚠️-INTENTIONALLY_VULNERABLE-red?style=for-the-badge)
![Education](https://img.shields.io/badge/Purpose-EDUCATIONAL_ONLY-orange?style=for-the-badge)

A deliberately vulnerable e-commerce web application designed for demonstrating web attack chaining techniques in security training and webinars.

## ⚠️ CRITICAL WARNING

**THIS APPLICATION IS INTENTIONALLY VULNERABLE AND INSECURE!**

- **NEVER** deploy this to production
- **NEVER** expose this to the public internet
- **ONLY** use in isolated, controlled environments for educational purposes
- Contains multiple severe security vulnerabilities by design

## 🎯 Purpose

This application is designed for security professionals, researchers, and students to:
- Learn and demonstrate web attack chaining techniques
- Practice penetration testing skills in a safe environment
- Understand common web vulnerabilities and their exploitation
- Present security concepts in webinars and training sessions

## 🏗️ Features

### E-commerce Functionality
- 🛍️ Browse luxury watch catalog
- 🔍 Search products
- 👤 User registration and authentication
- 🔐 Admin panel for product/user/order management
- 💬 Product reviews and ratings
- 🛒 Shopping cart and order placement
- 📦 Order history tracking

### Intentional Vulnerabilities
- **SQL Injection** - Login forms, search functionality, admin debug panel
- **Cross-Site Scripting (XSS)** - Product reviews, admin dashboard
- **CSRF** - All state-changing operations
- **IDOR** - User profiles, orders, sensitive data access
- **Authentication Bypass** - Multiple attack vectors
- **Weak Session Management** - Predictable tokens, no expiration
- **Information Disclosure** - Plain text passwords, verbose errors
- **Broken Access Control** - Missing authorization checks
- **Path Traversal** - File upload functionality

## 🚀 Quick Start

### Local Installation

```bash
# Clone or extract the application
cd web-chain

# Install dependencies
npm install

# Start the server
npm start
```

The application will be available at **http://localhost:3000**

### Docker Installation

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t luxwatch-vulnerable .
docker run -p 3000:3000 luxwatch-vulnerable
```

## 🔑 Default Credentials

### User Account
- **Username:** `user`
- **Password:** `user123`

### Admin Account
- **Username:** `admin`
- **Password:** `admin123`

### Additional Test User
- **Username:** `john`
- **Password:** `password`

## 📁 Project Structure

```
web-chain/
├── server.js              # Express server with vulnerable routes
├── database.js            # SQLite database with vulnerable queries
├── package.json           # Node.js dependencies
├── Dockerfile            # Docker configuration
├── docker-compose.yml    # Docker Compose setup
├── public/
│   ├── index.html        # Home page with product catalog
│   ├── login.html        # User login/registration
│   ├── admin-login.html  # Admin authentication
│   ├── dashboard.html    # User dashboard
│   ├── admin.html        # Admin panel
│   ├── css/
│   │   └── style.css     # Premium design system
│   ├── js/
│   │   └── main.js       # Client-side JavaScript
│   └── images/           # Product images
├── README.md             # This file
├── VULNERABILITIES.md    # Detailed vulnerability documentation
└── ATTACK_SCENARIOS.md   # Step-by-step attack examples
```


1. **Pull the Docker image**
2. **Run the container:**
   ```bash
   docker-compose up
   ```
3. **Access the application:** http://localhost:3000
4. **Try the attacks** yourself in your local environment

## 📚 Documentation

- **[VULNERABILITIES.md](./VULNERABILITIES.md)** - Complete list of vulnerabilities with technical details
- **[ATTACK_SCENARIOS.md](./ATTACK_SCENARIOS.md)** - Step-by-step attack chain demonstrations

## 🛠️ Technology Stack

- **Backend:** Node.js, Express.js
- **Database:** SQLite3
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Authentication:** Cookie-based sessions (vulnerable)
- **Container:** Docker

## 🔍 Key Vulnerabilities Overview

### 1. SQL Injection
- Login forms accept raw SQL
- Search functionality concatenates user input
- Admin debug panel allows arbitrary SQL execution

**Example:** `admin' OR '1'='1' --`

### 2. Cross-Site Scripting (XSS)
- Product reviews display without sanitization
- Admin dashboard reflects user input

**Example:** `<script>alert('XSS')</script>`

### 3. IDOR (Insecure Direct Object References)
- Access any user's profile: `/api/users/{id}`
- View any order: `/api/orders/{id}`
- No ownership validation

### 4. CSRF (Cross-Site Request Forgery)
- No CSRF tokens on any forms
- State-changing operations vulnerable

### 5. Authentication Issues
- Plain text password storage
- Predictable session tokens
- No password complexity requirements

## 🎯 Attack Chain Examples

See [ATTACK_SCENARIOS.md](./ATTACK_SCENARIOS.md) for detailed walkthroughs, including:

1. **SQL Injection → Authentication Bypass → Privilege Escalation**
2. **XSS → Session Hijacking → Account Takeover**
3. **IDOR → Data Exfiltration → Privacy Breach**
4. **CSRF → Unauthorized Actions → Account Manipulation**

## 🐛 Reporting Issues

This application is intentionally vulnerable. Do not report security vulnerabilities as they are by design. If you find bugs in the functionality itself (not security), you can report them for educational improvement.

## 📜 License

MIT License - For educational purposes only

## 🙏 Acknowledgments

Created for security education and awareness training.

**Remember: Practice ethical hacking only in authorized, controlled environments!**

---

**Happy Learning! Stay Secure! 🔒**
