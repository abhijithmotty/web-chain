# 🚨 LuxWatch - Intentionally Vulnerable Luxury Watch Shop 🚨

![WARNING](https://img.shields.io/badge/⚠️-INTENTIONALLY_VULNERABLE-red?style=for-the-badge)
![Education](https://img.shields.io/badge/Purpose-EDUCATIONAL_ONLY-orange?style=for-the-badge)

A realistic luxury watch e-commerce platform designed for penetration testing training, security demonstrations, and web attack chaining workshops. Features genuine-looking functionality with hidden vulnerabilities that require professional security testing tools to discover and exploit.

## ⚠️ CRITICAL WARNING

**THIS APPLICATION IS INTENTIONALLY VULNERABLE AND INSECURE!**

- **NEVER** deploy to production
- **NEVER** expose to the public internet
- **ONLY** use in isolated, controlled environments for educational purposes
- Contains multiple severe security vulnerabilities by design

## 🎯 Purpose

This application is designed for:
- Security professionals learning penetration testing
- Training workshops on web attack chaining
- Demonstrating IDOR, SQLi, XSS, and CSRF vulnerabilities
- Practicing Burpsuite skills in realistic scenarios
- Understanding business impact of web vulnerabilities

---

## 🏗️ Features

### E-Commerce Functionality

🛍️ **Product Catalog**
- Browse luxury watches from premium brands (Rolex, Patek Philippe, Omega, etc.)
- Advanced search functionality
- Product reviews and ratings

👤 **User Management**
- User registration and authentication
- Profile management
- Role-based access (user/admin)

📍 **Address Book**
- Save multiple shipping addresses
- Set default address
- Edit and delete addresses

💳 **Payment Methods**
- Save payment cards (tokenized)
- Manage multiple payment methods
- Default payment selection

📚 **Watch Collections**
- Create personalized watch collections
- Public or private visibility
- Organize favorite timepieces

❤️ **Wishlists**
- Save watches for later purchase
- Share wishlists via URL
- Public/private options

🎁 **Referral Program**
- Unique referral codes
- Track referral earnings
- View referral statistics

📦 **Order Management**
- Place orders
- View order history
- Real-time shipment tracking

🔧 **Admin Panel**
- Product inventory management
- User management dashboard
- Order oversight
- SQL debug console

---

## 🔓 Intentional Vulnerabilities

### IDOR (Insecure Direct Object References)
Access any user's data by manipulating resource IDs:
- User profiles → `/api/users/:id`
- Addresses → `/api/addresses/:id`
- Payment methods → `/api/payment-methods/:id`
- Orders → `/api/orders/:id`
- Collections → `/api/collections/:id`
- Wishlists → `/api/wishlists/:id`
- Referral stats → `/api/referrals/:userId`
- Order tracking → `/api/orders/:id/tracking`

### SQL Injection
- Login forms accept raw SQL
- Search functionality concatenates user input
- Admin debug panel allows arbitrary SQL execution

**Example:** `admin' OR '1'='1' --`

### Cross-Site Scripting (XSS)
- Product reviews display without sanitization
- Comment fields reflect user input
- Admin dashboard vulnerable to stored XSS

**Example:** `<script>alert('XSS')</script>`

### CSRF (Cross-Site Request Forgery)
- No CSRF tokens on any forms
- All state-changing operations vulnerable
- Product management, orders, reviews

### Authentication & Session Issues
- Plain text password storage
- Predictable session tokens (`userId_timestamp`)
- No HTTPOnly flag on cookies
- No session expiration

### Information Disclosure
- Verbose error messages leak database structure
- Passwords exposed in API responses
- Debug endpoints in production

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm

### Local Installation

```bash
# Navigate to directory
cd luxwatch

# Install dependencies
npm install

# Start the server
npm start
```

The application will be available at **http://localhost:3000**

### Docker Installation

```bash
# Build image
docker build -t luxwatch-vulnerable .

# Run container
docker run -p 3000:3000 luxwatch-vulnerable

# Or use docker-compose
docker-compose up -d
```

---

## 🔑 Default Credentials

### User Account
- **Username:** `user`
- **Password:** `user123`
- **ID:** 2

### Admin Account
- **Username:** `admin`
- **Password:** `admin123`
- **ID:** 1

### Additional Test User
- **Username:** `john`
- **Password:** `password`
- **ID:** 3

---

## 📁 Project Structure

```
luxwatch/
├── server.js                # Express server with vulnerable routes
├── database.js              # SQLite database with vulnerable queries
├── package.json             # Node.js dependencies
├── Dockerfile               # Docker configuration
├── docker-compose.yml       # Docker Compose setup
├── public/
│   ├── index.html           # Home page with product catalog
│   ├── login.html           # User login/registration
│   ├── admin-login.html     # Admin authentication
│   ├── dashboard.html       # User dashboard with all features
│   ├── admin.html           # Admin panel
│   ├── css/
│   │   └── style.css        # Premium design system
│   └── js/
│       └── main.js          # Client-side JavaScript
├── README.md                # This file
├── VULNERABILITIES.md       # Detailed vulnerability documentation
├── ATTACK_SCENARIOS.md      # Step-by-step attack examples
└── QUICK_REFERENCE.md       # Quick testing guide
```

---

## 🛠️ Technology Stack

- **Backend:** Node.js, Express.js
- **Database:** SQLite3
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Authentication:** Cookie-based sessions (vulnerable)
- **Container:** Docker

---

## 🔍 Testing with Burpsuite

### Setup

1. **Start Burpsuite**
   ```bash
   java -jar burpsuite.jar
   ```

2. **Configure Proxy**
   - Proxy → Options → 127.0.0.1:8080

3. **Configure Browser**
   - Set HTTP Proxy to 127.0.0.1:8080

4. **Start Testing**
   - Login as `user`
   - Navigate to any feature (Addresses, Payment Methods, etc.)
   - Intercept requests in Burpsuite
   - Modify resource IDs
   - Observe unauthorized data access

### Example IDOR Attack

1. Login as `user` (ID: 2)
2. Go to Dashboard → Addresses
3. Intercept: `GET /api/addresses/2`
4. **Change to:** `GET /api/addresses/1` (admin's address)
5. Forward request
6. View admin's personal address

---

## 📚 Documentation

- **[VULNERABILITIES.md](./VULNERABILITIES.md)** - Comprehensive vulnerability catalog with technical details
- **[ATTACK_SCENARIOS.md](./ATTACK_SCENARIOS.md)** - Step-by-step attack demonstrations
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Quick testing guide for instructors

---

## 🎓 Learning Objectives

By testing this application, you will learn:

1. **IDOR Discovery & Exploitation**
   - Identifying sequential resource IDs
   - Testing authorization boundaries
   - Automated enumeration techniques

2. **SQL Injection**
   - Authentication bypass
   - UNION-based data extraction
   - Database enumeration

3. **Cross-Site Scripting**
   - Stored XSS in user content
   - Session hijacking via XSS
   - Cookie theft

4. **Attack Chaining**
   - Combining multiple vulnerabilities
   - SQLi → XSS → IDOR
   - Privilege escalation chains

5. **Burpsuite Proficiency**
   - Proxy interception
   - Request modification
   - Intruder for automation
   - Repeater for manual testing

---

## 🎯 Attack Scenarios

### Scenario 1: Customer PII Theft
1. Authenticate as regular user
2. Use IDOR to enumerate all addresses: `/api/addresses/1-100`
3. Extract complete customer database
4. Result: Names, addresses, locations

### Scenario 2: Payment Card Breach
1. Login as user
2. Exploit IDOR on payment methods: `/api/payment-methods/:id`
3. Enumerate all saved cards
4. Result: Card types, last 4 digits, expiry dates

### Scenario 3: Business Intelligence
1. Access private collections via IDOR
2. View competitors' watch preferences
3. Track purchasing patterns
4. Result: Market intelligence, competitive advantage

### Scenario 4: Admin Takeover
1. SQL injection on login: `admin' --`
2. Bypass authentication
3. Access admin panel
4. Execute arbitrary SQL via debug console
5. Result: Complete system compromise

For detailed attack walkthroughs, see [ATTACK_SCENARIOS.md](./ATTACK_SCENARIOS.md)

---

## 🐛 Reporting Issues

This application is intentionally vulnerable. Do **not** report security vulnerabilities as they are by design. If you find functional bugs (not security issues), feel free to report them for educational improvement.

---

## 📜 License

MIT License - For educational purposes only

---

## 🙏 Acknowledgments

Created for security education and penetration testing training.

**Remember: Practice ethical hacking only in authorized, controlled environments!**

---

## 📞 Support

For questions about using this in training:
- Review the documentation in `/docs`
- Check ATTACK_SCENARIOS.md for specific examples
- Refer to VULNERABILITIES.md for complete vulnerability catalog

---

**Happy Learning! Stay Secure! 🔒**

---

## ⚖️ Legal Notice

**BY USING THIS APPLICATION, YOU AGREE:**

1. This is for **educational purposes only**
2. You will **never** deploy this to production
3. You will **never** expose this to public networks
4. You will only test on systems you own or have explicit permission to test
5. Unauthorized penetration testing is **illegal**
6. The creators are not responsible for misuse

**Use responsibly in controlled environments only.**
