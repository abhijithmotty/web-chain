# 🏦 SecureBank - Intentionally Vulnerable Banking Web Application

> ⚠️ **EDUCATIONAL PURPOSE ONLY** - This application contains intentional security vulnerabilities for learning web security and attack chaining techniques. **DO NOT deploy in production environments.**

## 📖 Overview

SecureBank is a deliberately vulnerable banking web application built with Flask, designed for practicing **web application security testing** and **attack chaining techniques**. The application simulates a basic online banking system with multiple security flaws that can be exploited individually or chained together for more sophisticated attacks.

## 🎯 Purpose

This project is designed for:
- **Security researchers** learning web application penetration testing
- **Students** studying web security and OWASP Top 10 vulnerabilities
- **CTF players** practicing attack chaining and exploitation techniques
- **Developers** understanding common security mistakes and how to prevent them

## 🐛 Intentional Vulnerabilities

### 1. **SQL Injection (SQLi)**
- **Location**: Login authentication (`/login`)
- **Location**: Admin search functionality (`/admin/search`)
- **Impact**: Authentication bypass, data extraction, privilege escalation
- **Example Payload**: 
  ```sql
  Username: admin' OR '1'='1
  Password: anything
  ```

### 2. **Cross-Site Scripting (XSS)**
- **Type**: Stored XSS
- **Location**: Transaction descriptions (`/transfer`)
- **Impact**: Session hijacking, credential theft, malicious script execution
- **Example Payload**:
  ```html
  <script>alert(document.cookie)</script>
  ```

### 3. **Cross-Site Request Forgery (CSRF)**
- **Location**: All state-changing operations (`/transfer`, `/admin/create`)
- **Impact**: Unauthorized fund transfers, account creation
- **Vulnerability**: No CSRF tokens implemented

### 4. **Weak Session Management**
- **Issue**: Hardcoded secret key (`super_secret_key_123`)
- **Impact**: Session hijacking, session forgery
- **Location**: `app.secret_key` in `app.py`

### 5. **Insecure Direct Object Reference (IDOR)**
- **Location**: User balance and transaction queries
- **Impact**: Unauthorized access to other users' data

### 6. **Authentication Bypass**
- **Mechanism**: SQL injection in login form
- **Impact**: Complete authentication bypass without valid credentials

### 7. **Privilege Escalation**
- **Path**: Regular user → Admin via SQL injection
- **Impact**: Full administrative access to the system

### 8. **Information Disclosure**
- **Debug mode enabled** in production
- **Stack traces** exposed to users
- **Database structure** revealed through error messages

## 🔗 Attack Chain Examples

### Chain 1: SQLi → Admin Access → Data Extraction
1. Use SQL injection to bypass login as admin
2. Access admin panel to view all user data
3. Extract sensitive information through admin search SQL injection

### Chain 2: XSS → Session Hijacking → CSRF
1. Inject malicious JavaScript in transaction description
2. Steal admin session cookie when admin views transactions
3. Use stolen session to perform unauthorized admin actions

### Chain 3: Authentication Bypass → Fund Transfer → XSS Persistence
1. Bypass authentication using SQL injection
2. Transfer funds from victim accounts
3. Plant XSS payloads in transaction descriptions for persistence

## 🚀 Getting Started

### Prerequisites
- Docker and Docker Compose installed
- Basic understanding of web security concepts

### Installation & Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/abhijithmotty/web-chain
   cd Bank
   ```

2. **Build and run with Docker Compose**
   ```bash
   docker-compose up --build
   ```

3. **Access the application**
   - Open your browser and navigate to: `http://localhost:5000`

### Default Credentials

| Username | Password   | Role  | Balance  |
|----------|-----------|-------|----------|
| admin    | admin123  | admin | $10,000  |
| john     | password  | user  | $5,000   |
| alice    | alice123  | user  | $3,000   |

## 📂 Project Structure

```
Bank/
├── app.py              # Main Flask application with vulnerabilities
├── Dockerfile          # Docker container configuration
├── docker-compose.yml  # Docker Compose orchestration
├── requirements.txt    # Python dependencies
├── bank.db/           # SQLite database directory (created at runtime)
└── README.md          # This file
```

## 🔍 Features

### User Features
- User registration and authentication
- Account balance viewing
- Fund transfers between users
- Transaction history

### Admin Features
- User search functionality
- User creation with role assignment
- View all system transactions
- Manage user accounts

## 🛡️ Security Testing Guide

### Recommended Tools
- **Burp Suite** - For intercepting and modifying HTTP requests
- **SQLMap** - Automated SQL injection exploitation
- **OWASP ZAP** - Web application security scanner
- **Browser DevTools** - For analyzing client-side vulnerabilities

### Testing Steps

1. **Enumerate the application**
   - Map all endpoints and functionality
   - Identify input fields and parameters

2. **Test SQL Injection**
   - Try common SQLi payloads in login form
   - Test admin search with UNION-based injection
   - Extract database schema and data

3. **Test XSS**
   - Inject JavaScript in transaction descriptions
   - Verify script execution in dashboard
   - Test for cookie theft scenarios

4. **Test CSRF**
   - Create malicious HTML form for fund transfer
   - Host on external domain
   - Trick authenticated user to visit

5. **Chain Attacks**
   - Combine vulnerabilities for maximum impact
   - Document the attack chain

## 🎓 Learning Objectives

By working with this application, you will learn:
- How to identify and exploit SQL injection vulnerabilities
- Understanding XSS attack vectors and mitigation
- CSRF attack mechanisms and prevention techniques
- Session management security best practices
- The importance of input validation and output encoding
- How to chain multiple vulnerabilities for sophisticated attacks
- Secure coding practices for web applications

## ⚖️ Legal Disclaimer

> **IMPORTANT**: This application is provided for **educational purposes only**. 
> 
> - Only use this application in controlled, isolated environments
> - Never deploy this application on public-facing servers
> - Do not use these techniques on systems you don't own or have explicit permission to test
> - Unauthorized access to computer systems is illegal
> - The authors are not responsible for any misuse of this software

## 🛠️ Technology Stack

- **Backend**: Flask (Python 3.9)
- **Database**: SQLite3
- **Frontend**: HTML/CSS (inline templates)
- **Containerization**: Docker

## 📚 Additional Resources

### OWASP References
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

### Learning Platforms
- [PortSwigger Web Security Academy](https://portswigger.net/web-security)
- [OWASP WebGoat](https://owasp.org/www-project-webgoat/)
- [HackTheBox](https://www.hackthebox.com/)

## 🔧 Troubleshooting

### Application won't start
```bash
# Stop and remove existing containers
docker-compose down

# Rebuild and start fresh
docker-compose up --build
```

### Database issues
```bash
# Remove the database volume
docker-compose down -v

# Restart the application
docker-compose up
```

### Port already in use
Edit `docker-compose.yml` and change the port mapping:
```yaml
ports:
  - "5001:5000"  # Change 5001 to any available port
```

## 🤝 Contributing

This is an educational project. If you'd like to contribute:
- Add new vulnerability scenarios
- Improve documentation
- Create challenge scenarios
- Add more attack chain examples

## 📝 License

This project is provided as-is for educational purposes. Use at your own risk.

---

**Remember**: With great power comes great responsibility. Use your security knowledge ethically! 🦸‍♂️
