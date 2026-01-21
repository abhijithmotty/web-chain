const express = require('express');
const router = express.Router();

// Login page
router.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// VULNERABLE: SQL Injection in login
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    const db = req.app.locals.db;

    // INTENTIONALLY VULNERABLE - SQL Injection
    const query = `SELECT * FROM users WHERE email = '${email}' AND password = '${password}'`;

    db.get(query, (err, user) => {
        if (err) {
            console.error('Login error:', err);
            return res.render('login', { error: 'Database error occurred' });
        }

        if (user) {
            // Set session - VULNERABLE: No proper session management
            req.session.userId = user.id;
            req.session.userEmail = user.email;
            req.session.userName = user.full_name;
            req.session.isAdmin = user.is_admin;

            // VULNERABLE: Setting sensitive data in cookies
            res.cookie('userId', user.id);
            res.cookie('isAdmin', user.is_admin);

            if (user.is_admin) {
                res.redirect('/admin/dashboard');
            } else {
                res.redirect('/user/dashboard');
            }
        } else {
            res.render('login', { error: 'Invalid credentials' });
        }
    });
});

// Registration page
router.get('/register', (req, res) => {
    res.render('register', { error: null, success: null });
});

// VULNERABLE: Mass assignment, no input validation
router.post('/register', (req, res) => {
    const db = req.app.locals.db;

    // VULNERABLE: Accept all parameters from request body (mass assignment)
    let { email, password, full_name, is_admin, balance, credit_score } = req.body;

    // Generate account number
    const accountNumber = generateAccountNumber();

    // Use defaults if not provided, but accept malicious values if provided
    balance = balance || 10000.00;
    credit_score = credit_score || 650;
    is_admin = is_admin || 0;

    // VULNERABLE: No password hashing
    const query = `INSERT INTO users (email, password, full_name, account_number, balance, credit_score, is_admin) 
                   VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.run(query, [email, password, full_name, accountNumber, balance, credit_score, is_admin], function (err) {
        if (err) {
            console.error('Registration error:', err);
            return res.render('register', { error: 'Registration failed. Email may already exist.', success: null });
        }

        const userId = this.lastID;

        // Auto-generate credit card
        const cardNumber = generateCardNumber();
        const cvv = String(Math.floor(Math.random() * 900) + 100);
        const expiryDate = '12/27';
        const cardType = 'basic';
        const creditLimit = 5000.00;

        db.run(`INSERT INTO credit_cards (user_id, card_number, cvv, expiry_date, card_type, credit_limit, status)
                VALUES (?, ?, ?, ?, ?, ?, 'active')`,
            [userId, cardNumber, cvv, expiryDate, cardType, creditLimit], (err) => {
                if (err) {
                    console.error('Card creation error:', err);
                }
            });

        res.render('register', {
            error: null,
            success: `Account created successfully! Your account number is ${accountNumber}. You can now login.`
        });
    });
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.clearCookie('userId');
    res.clearCookie('isAdmin');
    res.redirect('/auth/login');
});

// Helper functions
function generateAccountNumber() {
    const part1 = 'RDFC';
    const part2 = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const part3 = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const part4 = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `${part1}-${part2}-${part3}-${part4}`;
}

function generateCardNumber() {
    // Generate a 16-digit card number
    let cardNumber = '4532'; // Visa prefix
    for (let i = 0; i < 12; i++) {
        cardNumber += Math.floor(Math.random() * 10);
    }
    return cardNumber;
}

module.exports = router;
