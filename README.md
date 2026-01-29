# Web-Chain

Intentionally vulnerable web applications for security training and web attack chaining demonstrations.

## 🎯 Applications

### 🏦 [RDFincorp](./RDFincorp/) - Banking Application
Vulnerable banking platform with user accounts, transfers, and admin panel.
- **Port**: 3000

### ⌚ [luxwatch](./luxwatch/) - Luxury Watch Shop
E-commerce platform for premium timepieces with shopping cart and inventory management.
- **Port**: 3000
- **Login**: admin/admin123

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/abhijithmotty/web-chain.git
cd web-chain

# Run Banking App
cd bank
docker-compose up --build

# Run Watch Shop (in new terminal)
cd luxwatch
docker-compose up --build
```

## ⚠️ Warning

These applications are **INTENTIONALLY VULNERABLE** for educational purposes only. 

- ❌ Never deploy on production
- ❌ Never expose to public networks
- ✅ Use only in isolated lab environments
- ✅ For authorized security training only

## 🐛 Vulnerabilities

- SQL Injection
- XSS (Cross-Site Scripting)
- CSRF (Cross-Site Request Forgery)
- Broken Authentication
- Insecure Session Management

## 📚 Documentation

See individual application folders for detailed setup instructions and attack demonstrations.

---

**Use responsibly. Educational purposes only.**
