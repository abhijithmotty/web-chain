const express = require('express');
const router = express.Router();

// VULNERABLE: No authentication check middleware
function checkAuth(req, res, next) {
    // Intentionally weak - only checks if userId exists, doesn't validate
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/auth/login');
    }
}

// User dashboard
router.get('/dashboard', checkAuth, (req, res) => {
    const db = req.app.locals.db;
    const userId = req.session.userId;

    // Get user info
    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) {
            return res.redirect('/auth/login');
        }

        // Get user's credit cards - ONLY active and pending, NOT rejected
        db.all('SELECT * FROM credit_cards WHERE user_id = ? AND status != ?', [userId, 'rejected'], (err, cards) => {
            // Get recent transactions
            db.all(`SELECT t.*, 
                           u1.full_name as from_name, 
                           u2.full_name as to_name
                    FROM transactions t
                    LEFT JOIN users u1 ON t.from_user_id = u1.id
                    LEFT JOIN users u2 ON t.to_user_id = u2.id
                    WHERE t.from_user_id = ? OR t.to_user_id = ?
                    ORDER BY t.created_at DESC LIMIT 10`,
                [userId, userId], (err, transactions) => {

                    // Get user's loan applications (approved and rejected for notifications)
                    db.all(`SELECT * FROM loans WHERE user_id = ? 
                            AND status IN ('approved', 'rejected')
                            ORDER BY reviewed_at DESC LIMIT 5`,
                        [userId], (err, loans) => {

                            res.render('dashboard', {
                                user: user,
                                cards: cards || [],
                                transactions: transactions || [],
                                recentLoans: loans || []
                            });
                        });
                });
        });
    });
});

// Apply for credit card
router.get('/apply-card', checkAuth, (req, res) => {
    const db = req.app.locals.db;
    const userId = req.session.userId;

    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        res.render('apply-card', { user: user, success: null, error: null });
    });
});

router.post('/apply-card', checkAuth, (req, res) => {
    const db = req.app.locals.db;
    const userId = req.session.userId;
    const { card_type } = req.body;

    const cardNumber = generateCardNumber();
    const cvv = String(Math.floor(Math.random() * 900) + 100);
    const expiryDate = '12/28';

    let creditLimit;
    switch (card_type) {
        case 'silver': creditLimit = 10000; break;
        case 'gold': creditLimit = 25000; break;
        case 'platinum': creditLimit = 50000; break;
        default: creditLimit = 5000;
    }

    db.run(`INSERT INTO credit_cards (user_id, card_number, cvv, expiry_date, card_type, credit_limit, status)
            VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [userId, cardNumber, cvv, expiryDate, card_type, creditLimit], (err) => {

            db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
                if (err) {
                    res.render('apply-card', { user: user, success: null, error: 'Application failed' });
                } else {
                    res.render('apply-card', { user: user, success: 'Credit card application submitted! Awaiting admin approval.', error: null });
                }
            });
        });
});

// Apply for loan
router.get('/apply-loan', checkAuth, (req, res) => {
    const db = req.app.locals.db;
    const userId = req.session.userId;

    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        res.render('apply-loan', { user: user, success: null, error: null });
    });
});

// VULNERABLE: No CSRF protection
router.post('/apply-loan', checkAuth, (req, res) => {
    const db = req.app.locals.db;
    const userId = req.session.userId;
    const { amount, purpose } = req.body;

    // VULNERABLE: XSS - purpose is not sanitized
    db.run(`INSERT INTO loans (user_id, amount, purpose, status)
            VALUES (?, ?, ?, 'pending')`,
        [userId, amount, purpose], (err) => {

            db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
                if (err) {
                    res.render('apply-loan', { user: user, success: null, error: 'Loan application failed' });
                } else {
                    res.render('apply-loan', { user: user, success: 'Loan application submitted successfully!', error: null });
                }
            });
        });
});

function generateCardNumber() {
    let cardNumber = '4532';
    for (let i = 0; i < 12; i++) {
        cardNumber += Math.floor(Math.random() * 10);
    }
    return cardNumber;
}

// User Profile Page
router.get('/profile', checkAuth, (req, res) => {
    const db = req.app.locals.db;
    const userId = req.session.userId;

    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        res.render('profile', { user: user, success: null, error: null });
    });
});

// VULNERABLE: No CSRF protection on profile update
router.post('/profile', checkAuth, (req, res) => {
    const db = req.app.locals.db;
    const userId = req.session.userId;
    const { full_name, email, password, balance, credit_score } = req.body;

    // VULNERABLE: Mass assignment - accepts balance and credit_score from user
    // VULNERABLE: No password hashing
    // VULNERABLE: No CSRF token check

    let query = 'UPDATE users SET full_name = ?, email = ?';
    let params = [full_name, email];

    // If password provided, update it (no hashing - vulnerable!)
    if (password && password.length > 0) {
        query += ', password = ?';
        params.push(password);
    }

    // VULNERABLE: Allow updating balance and credit score if provided
    if (balance !== undefined && balance !== '') {
        query += ', balance = ?';
        params.push(parseFloat(balance));
    }

    if (credit_score !== undefined && credit_score !== '') {
        query += ', credit_score = ?';
        params.push(parseInt(credit_score));
    }

    query += ' WHERE id = ?';
    params.push(userId);

    db.run(query, params, (err) => {
        db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
            if (err) {
                res.render('profile', { user: user, success: null, error: 'Profile update failed' });
            } else {
                // Update session data
                req.session.userName = user.full_name;
                req.session.userEmail = user.email;

                res.render('profile', { user: user, success: 'Profile updated successfully!', error: null });
            }
        });
    });
});

module.exports = router;

