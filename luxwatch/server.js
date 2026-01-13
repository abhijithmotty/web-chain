const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const multer = require('multer');
const db = require('./database');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// VULNERABLE: No CSRF protection
// VULNERABLE: Weak authentication middleware
function checkAuth(req, res, next) {
    const sessionToken = req.cookies.session;
    if (!sessionToken) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    db.getSession(sessionToken, (err, session) => {
        if (err || !session) {
            return res.status(401).json({ error: 'Invalid session' });
        }

        db.getUserById(session.user_id, (err, user) => {
            if (err || !user) {
                return res.status(401).json({ error: 'User not found' });
            }
            req.user = user;
            next();
        });
    });
}

// VULNERABLE: No proper role checking - easily bypassable
function checkAdmin(req, res, next) {
    // Intentionally weak - only checks user object, which can be manipulated
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Admin access required' });
    }
}

// File upload configuration (vulnerable to path traversal)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        // VULNERABLE: No sanitization of filename
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// Initialize database
db.initializeDatabase();

// ============= PUBLIC ROUTES =============

// Login endpoint - VULNERABLE to SQL Injection
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // Intentionally vulnerable to SQL injection
    db.authenticateUser(username, password, (err, users) => {
        if (err) {
            return res.status(500).json({ error: 'Database error', details: err.message });
        }

        if (users && users.length > 0) {
            const user = users[0];

            // Create session
            db.createSession(user.id, (err, sessionToken) => {
                if (err) {
                    return res.status(500).json({ error: 'Session creation failed' });
                }

                // Set cookie
                res.cookie('session', sessionToken, { httpOnly: false }); // VULNERABLE: not httpOnly
                res.json({
                    success: true,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        role: user.role
                    }
                });
            });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    });
});

// Register endpoint
app.post('/api/register', (req, res) => {
    const { username, password, email } = req.body;

    // VULNERABLE: No password strength validation, plain text storage
    db.registerUser(username, password, email, (err) => {
        if (err) {
            return res.status(400).json({ error: 'Registration failed', details: err.message });
        }
        res.json({ success: true, message: 'Registration successful' });
    });
});

// Logout
app.post('/api/logout', (req, res) => {
    res.clearCookie('session');
    res.json({ success: true });
});

// Get all products
app.get('/api/products', (req, res) => {
    db.getAllProducts((err, products) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(products);
    });
});

// Search products - VULNERABLE to SQL Injection
app.get('/api/search', (req, res) => {
    const searchTerm = req.query.q;

    db.searchProducts(searchTerm, (err, products) => {
        if (err) {
            return res.status(500).json({ error: 'Search failed', details: err.message });
        }
        res.json(products);
    });
});

// Get product by ID
app.get('/api/products/:id', (req, res) => {
    const productId = req.params.id;

    db.getProductById(productId, (err, product) => {
        if (err || !product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product);
    });
});

// Get product reviews
app.get('/api/products/:id/reviews', (req, res) => {
    const productId = req.params.id;

    db.getProductReviews(productId, (err, reviews) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch reviews' });
        }
        res.json(reviews);
    });
});

// ============= AUTHENTICATED USER ROUTES =============

// Get current user
app.get('/api/user', checkAuth, (req, res) => {
    res.json({
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role
    });
});

// VULNERABLE: IDOR - Get user by ID (no authorization check)
app.get('/api/users/:id', checkAuth, (req, res) => {
    const userId = req.params.id;

    db.getUserById(userId, (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Returns sensitive user data without checking if requester should have access
        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            password: user.password // VULNERABLE: Exposing password
        });
    });
});

// Create order
app.post('/api/orders', checkAuth, (req, res) => {
    const { productId, quantity } = req.body;
    const userId = req.user.id;

    db.getProductById(productId, (err, product) => {
        if (err || !product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const totalPrice = product.price * quantity;

        db.createOrder(userId, productId, quantity, totalPrice, (err) => {
            if (err) {
                return res.status(500).json({ error: 'Order creation failed' });
            }
            res.json({ success: true, message: 'Order placed successfully' });
        });
    });
});

// Get user orders
app.get('/api/orders/my', checkAuth, (req, res) => {
    db.getUserOrders(req.user.id, (err, orders) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch orders' });
        }
        res.json(orders);
    });
});

// VULNERABLE: IDOR - Get order by ID (no ownership check)
app.get('/api/orders/:id', checkAuth, (req, res) => {
    const orderId = req.params.id;

    db.getOrderById(orderId, (err, order) => {
        if (err || !order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        // No check if this order belongs to the current user
        res.json(order);
    });
});

// Add review - VULNERABLE to XSS
app.post('/api/reviews', checkAuth, (req, res) => {
    const { productId, rating, comment } = req.body;
    const userId = req.user.id;
    const username = req.user.username;

    // No sanitization of comment - XSS vulnerability
    db.addReview(productId, userId, username, rating, comment, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to add review' });
        }
        res.json({ success: true, message: 'Review added successfully' });
    });
});

// ============= ADMIN ROUTES =============

// Get all users (admin only)
app.get('/api/admin/users', checkAuth, checkAdmin, (req, res) => {
    db.getAllUsers((err, users) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch users' });
        }
        res.json(users);
    });
});

// Get all orders (admin only)
app.get('/api/admin/orders', checkAuth, checkAdmin, (req, res) => {
    db.getAllOrders((err, orders) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch orders' });
        }
        res.json(orders);
    });
});

// Add product (admin only) - VULNERABLE: No CSRF protection
app.post('/api/admin/products', checkAuth, checkAdmin, (req, res) => {
    const { name, brand, description, price, image, stock } = req.body;

    db.addProduct(name, brand, description, price, image, stock, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to add product' });
        }
        res.json({ success: true, message: 'Product added successfully' });
    });
});

// Update product (admin only) - VULNERABLE: No CSRF protection
app.put('/api/admin/products/:id', checkAuth, checkAdmin, (req, res) => {
    const productId = req.params.id;
    const { name, brand, description, price, image, stock } = req.body;

    db.updateProduct(productId, name, brand, description, price, image, stock, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to update product' });
        }
        res.json({ success: true, message: 'Product updated successfully' });
    });
});

// Delete product (admin only) - VULNERABLE: No CSRF protection
app.delete('/api/admin/products/:id', checkAuth, checkAdmin, (req, res) => {
    const productId = req.params.id;

    db.deleteProduct(productId, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to delete product' });
        }
        res.json({ success: true, message: 'Product deleted successfully' });
    });
});

// File upload (admin only) - VULNERABLE to path traversal
app.post('/api/admin/upload', checkAuth, checkAdmin, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({
        success: true,
        filename: req.file.filename,
        path: `/uploads/${req.file.filename}`
    });
});

// VULNERABLE: Direct SQL query execution (admin debug endpoint)
app.post('/api/admin/query', checkAuth, checkAdmin, (req, res) => {
    const { query } = req.body;

    // Extremely dangerous - allows arbitrary SQL execution
    db.vulnerableQuery(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Query failed', details: err.message });
        }
        res.json(results);
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚨 VULNERABLE LUXURY WATCH SHOP 🚨                      ║
║                                                           ║
║   WARNING: This application is INTENTIONALLY VULNERABLE   ║
║   For educational purposes only!                          ║
║                                                           ║
║   Server running on: http://localhost:${PORT}              ║
║                                                           ║
║   Default Credentials:                                    ║
║   Admin: admin / admin123                                 ║
║   User:  user / user123                                   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
