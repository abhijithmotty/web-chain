const express = require('express');
const router = express.Router();

// VULNERABLE: Weak admin check - only checks session variable
function checkAdmin(req, res, next) {
    if (req.session.isAdmin) {
        next();
    } else {
        res.status(403).send('Access denied');
    }
}

// Admin dashboard
router.get('/dashboard', checkAdmin, (req, res) => {
    const db = req.app.locals.db;

    // Get all users
    db.all('SELECT * FROM users', (err, users) => {
        // Get pending loans
        db.all(`SELECT l.*, u.full_name, u.email, u.credit_score 
                FROM loans l 
                JOIN users u ON l.user_id = u.id 
                WHERE l.status = 'pending'`, (err, pendingLoans) => {

            // Get pending card applications
            db.all(`SELECT c.*, u.full_name, u.email, u.credit_score 
                    FROM credit_cards c 
                    JOIN users u ON c.user_id = u.id 
                    WHERE c.status = 'pending'`, (err, pendingCards) => {

                // Get all transactions
                db.all(`SELECT t.*, 
                               u1.full_name as from_name, 
                               u2.full_name as to_name
                        FROM transactions t
                        LEFT JOIN users u1 ON t.from_user_id = u1.id
                        LEFT JOIN users u2 ON t.to_user_id = u2.id
                        ORDER BY t.created_at DESC LIMIT 20`, (err, transactions) => {

                    const stats = {
                        totalUsers: users ? users.length : 0,
                        pendingLoans: pendingLoans ? pendingLoans.length : 0,
                        pendingCards: pendingCards ? pendingCards.length : 0,
                        totalTransactions: transactions ? transactions.length : 0
                    };

                    res.render('admin', {
                        admin: req.session,
                        stats: stats,
                        users: users || [],
                        pendingLoans: pendingLoans || [],
                        pendingCards: pendingCards || [],
                        transactions: transactions || []
                    });
                });
            });
        });
    });
});

// VULNERABLE: No CSRF protection on admin actions
router.post('/approve-loan/:loanId', checkAdmin, (req, res) => {
    const db = req.app.locals.db;
    const { loanId } = req.params;
    const { action, notes } = req.body;

    const status = action === 'approve' ? 'approved' : 'rejected';

    // Get loan details first
    db.get('SELECT * FROM loans WHERE id = ?', [loanId], (err, loan) => {
        if (err || !loan) {
            console.error('Error fetching loan:', err);
            return res.redirect('/admin/dashboard');
        }

        // Update loan status
        db.run(`UPDATE loans SET status = ?, admin_notes = ?, reviewed_at = CURRENT_TIMESTAMP 
                WHERE id = ?`, [status, notes, loanId], (err) => {
            if (err) {
                console.error('Error updating loan:', err);
                return res.redirect('/admin/dashboard');
            }

            // If approved, credit the loan amount to user's balance
            if (status === 'approved') {
                db.run(`UPDATE users SET balance = balance + ? WHERE id = ?`,
                    [loan.amount, loan.user_id], (err) => {
                        if (err) {
                            console.error('Error updating user balance:', err);
                        }
                        res.redirect('/admin/dashboard');
                    });
            } else {
                res.redirect('/admin/dashboard');
            }
        });
    });
});

router.post('/approve-card/:cardId', checkAdmin, (req, res) => {
    const db = req.app.locals.db;
    const { cardId } = req.params;
    const { action } = req.body;

    const status = action === 'approve' ? 'active' : 'rejected';

    db.run(`UPDATE credit_cards SET status = ? WHERE id = ?`, [status, cardId], (err) => {
        if (err) {
            console.error('Error updating card:', err);
        }
        res.redirect('/admin/dashboard');
    });
});

// VULNERABLE: Admin can create users with any privileges
router.post('/create-user', checkAdmin, (req, res) => {
    const db = req.app.locals.db;
    const { email, password, full_name, is_admin, balance, credit_score } = req.body;

    // Generate account number
    const accountNumber = generateAccountNumber();

    // Set defaults if not provided
    const userBalance = balance || 10000.00;
    const userCreditScore = credit_score || 650;
    const userIsAdmin = is_admin === 'on' ? 1 : 0;

    // VULNERABLE: No password hashing, no input validation
    const query = `INSERT INTO users (email, password, full_name, account_number, balance, credit_score, is_admin) 
                   VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.run(query, [email, password, full_name, accountNumber, userBalance, userCreditScore, userIsAdmin], function (err) {
        if (err) {
            console.error('User creation error:', err);
            return res.redirect('/admin/dashboard?error=User creation failed');
        }

        const userId = this.lastID;

        // Auto-generate basic credit card for new user
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
                res.redirect('/admin/dashboard?success=User created successfully');
            });
    });
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
    let cardNumber = '4532'; // Visa prefix
    for (let i = 0; i < 12; i++) {
        cardNumber += Math.floor(Math.random() * 10);
    }
    return cardNumber;
}

module.exports = router;
