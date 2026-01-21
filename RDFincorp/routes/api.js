const express = require('express');
const router = express.Router();

// VULNERABLE: IDOR - No authorization checks on user-specific data
router.get('/user/:userId', (req, res) => {
    const db = req.app.locals.db;
    const { userId } = req.params;

    // No check if requesting user has permission to view this user's data
    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // VULNERABLE: Exposing sensitive data including password
        res.json(user);
    });
});

// VULNERABLE: IDOR on transactions
router.get('/transactions/:userId', (req, res) => {
    const db = req.app.locals.db;
    const { userId } = req.params;

    db.all(`SELECT t.*, 
                   u1.full_name as from_name, u1.account_number as from_account,
                   u2.full_name as to_name, u2.account_number as to_account
            FROM transactions t
            LEFT JOIN users u1 ON t.from_user_id = u1.id
            LEFT JOIN users u2 ON t.to_user_id = u2.id
            WHERE t.from_user_id = ? OR t.to_user_id = ?
            ORDER BY t.created_at DESC`, [userId, userId], (err, transactions) => {

        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(transactions);
    });
});

// VULNERABLE: IDOR on credit cards
router.get('/cards/:userId', (req, res) => {
    const db = req.app.locals.db;
    const { userId } = req.params;

    db.all('SELECT * FROM credit_cards WHERE user_id = ?', [userId], (err, cards) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        // VULNERABLE: Exposing CVV and full card details
        res.json(cards);
    });
});

// VULNERABLE: IDOR on specific card
router.get('/card/:cardId', (req, res) => {
    const db = req.app.locals.db;
    const { cardId } = req.params;

    db.get('SELECT * FROM credit_cards WHERE id = ?', [cardId], (err, card) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (!card) {
            return res.status(404).json({ error: 'Card not found' });
        }
        res.json(card);
    });
});

// VULNERABLE: IDOR on loans
router.get('/loan/:loanId', (req, res) => {
    const db = req.app.locals.db;
    const { loanId } = req.params;

    db.get(`SELECT l.*, u.full_name, u.email, u.credit_score 
            FROM loans l 
            JOIN users u ON l.user_id = u.id 
            WHERE l.id = ?`, [loanId], (err, loan) => {

        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (!loan) {
            return res.status(404).json({ error: 'Loan not found' });
        }
        res.json(loan);
    });
});

// VULNERABLE: No CSRF protection, IDOR on transfers
router.post('/transfer', (req, res) => {
    const db = req.app.locals.db;
    const { from_user_id, to_account, amount, notes } = req.body;

    // Find recipient by account number
    db.get('SELECT id FROM users WHERE account_number = ?', [to_account], (err, recipient) => {
        if (err || !recipient) {
            return res.status(400).json({ error: 'Recipient not found' });
        }

        // No balance check, no authorization check
        db.run(`INSERT INTO transactions (from_user_id, to_user_id, amount, transaction_type, notes)
                VALUES (?, ?, ?, 'transfer', ?)`,
            [from_user_id, recipient.id, amount, notes], (err) => {

                if (err) {
                    return res.status(500).json({ error: 'Transfer failed' });
                }

                // Update balances (vulnerable to race conditions)
                db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, from_user_id]);
                db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, recipient.id]);

                res.json({ success: true, message: 'Transfer completed' });
            });
    });
});

// VULNERABLE: SQL Injection in search
router.get('/search', (req, res) => {
    const db = req.app.locals.db;
    const { query } = req.query;

    // VULNERABLE: Direct string concatenation
    const searchQuery = `SELECT * FROM transactions WHERE notes LIKE '%${query}%'`;

    db.all(searchQuery, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// VULNERABLE: Exposed database backup endpoint
router.get('/backup', (req, res) => {
    const db = req.app.locals.db;

    // Return all users with passwords
    db.all('SELECT * FROM users', (err, users) => {
        res.json({ users: users, message: 'Database backup' });
    });
});

// Update user profile - VULNERABLE: Mass assignment, XSS
router.post('/update-profile', (req, res) => {
    const db = req.app.locals.db;
    const userId = req.session.userId;

    // VULNERABLE: Accept all fields without sanitization
    const { full_name, email, balance, credit_score, is_admin } = req.body;

    // Build query dynamically (vulnerable)
    let updates = [];
    let values = [];

    if (full_name) {
        updates.push('full_name = ?');
        values.push(full_name); // XSS vulnerable
    }
    if (email) {
        updates.push('email = ?');
        values.push(email);
    }
    if (balance) {
        updates.push('balance = ?');
        values.push(balance); // Mass assignment
    }
    if (credit_score) {
        updates.push('credit_score = ?');
        values.push(credit_score); // Mass assignment
    }
    if (is_admin !== undefined) {
        updates.push('is_admin = ?');
        values.push(is_admin); // Privilege escalation
    }

    values.push(userId);

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

    db.run(query, values, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Update failed' });
        }
        res.json({ success: true, message: 'Profile updated' });
    });
});

module.exports = router;
