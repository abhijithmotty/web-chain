const express = require('express');
const router = express.Router();

// ─────────────────────────────────────────────────────────────
//  Auth middleware — VULNERABLE but fixed for back-button bug
// ─────────────────────────────────────────────────────────────
function checkAuth(req, res, next) {
    // Set no-cache headers on EVERY protected response
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });

    if (req.session && req.session.userId && req.session.loggedIn) {
        // Admins must not access the user area — redirect them to their own dashboard.
        // This prevents session cross-contamination when pressing Back after role switch.
        if (req.session.isAdmin) {
            return res.redirect('/admin/dashboard');
        }
        return next();
    }
    res.redirect('/auth/login');
}

// ─── User Dashboard ───────────────────────────────────────────
router.get('/dashboard', checkAuth, (req, res) => {
    const db = req.app.locals.db;
    const difficulty = req.app.locals.difficulty;
    const difficultyLocked = req.app.locals.difficultyLocked;
    const userId = req.session.userId;

    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) return res.redirect('/auth/login');

        db.all('SELECT * FROM credit_cards WHERE user_id = ? AND status != ?', [userId, 'rejected'], (err, cards) => {
            db.all(`SELECT t.*, u1.full_name as from_name, u2.full_name as to_name
                    FROM transactions t
                    LEFT JOIN users u1 ON t.from_user_id = u1.id
                    LEFT JOIN users u2 ON t.to_user_id = u2.id
                    WHERE t.from_user_id = ? OR t.to_user_id = ?
                    ORDER BY t.created_at DESC LIMIT 10`,
                [userId, userId], (err, transactions) => {
                    db.all(`SELECT * FROM loans WHERE user_id = ? AND status IN ('approved','rejected') ORDER BY reviewed_at DESC LIMIT 5`,
                        [userId], (err, loans) => {
                            res.render('dashboard', {
                                user,
                                cards: cards || [],
                                transactions: transactions || [],
                                recentLoans: loans || [],
                                difficulty,
                                difficultyLocked
                            });
                        });
                });
        });
    });
});

// ─── Apply Credit Card ────────────────────────────────────────
router.get('/apply-card', checkAuth, (req, res) => {
    const db = req.app.locals.db;
    const difficulty = req.app.locals.difficulty;
    const difficultyLocked = req.app.locals.difficultyLocked;
    db.get('SELECT * FROM users WHERE id = ?', [req.session.userId], (err, user) => {
        res.render('apply-card', { user, success: null, error: null, difficulty, difficultyLocked });
    });
});

router.post('/apply-card', checkAuth, (req, res) => {
    const db = req.app.locals.db;
    const difficulty = req.app.locals.difficulty;
    const difficultyLocked = req.app.locals.difficultyLocked;
    const userId = req.session.userId;
    const { card_type } = req.body;

    const cardNumber = generateCardNumber();
    const cvv = String(Math.floor(Math.random() * 900) + 100);
    const limits = { silver: 10000, gold: 25000, platinum: 50000 };
    const creditLimit = limits[card_type] || 5000;

    db.run(`INSERT INTO credit_cards (user_id, card_number, cvv, expiry_date, card_type, credit_limit, status) VALUES (?, ?, ?, '12/29', ?, ?, 'pending')`,
        [userId, cardNumber, cvv, card_type, creditLimit], (err) => {
            db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
                res.render('apply-card', {
                    user,
                    success: err ? null : 'Credit card application submitted! Awaiting admin approval.',
                    error: err ? 'Application failed. Please try again.' : null,
                    difficulty,
                    difficultyLocked
                });
            });
        });
});

// ─── Apply Loan ────────────────────────────────────────────────
router.get('/apply-loan', checkAuth, (req, res) => {
    const db = req.app.locals.db;
    const difficulty = req.app.locals.difficulty;
    const difficultyLocked = req.app.locals.difficultyLocked;
    db.get('SELECT * FROM users WHERE id = ?', [req.session.userId], (err, user) => {
        res.render('apply-loan', { user, success: null, error: null, difficulty, difficultyLocked });
    });
});

// VULNERABLE: No CSRF protection (all levels), XSS via purpose (Easy/Medium)
router.post('/apply-loan', checkAuth, (req, res) => {
    const db = req.app.locals.db;
    const difficulty = req.app.locals.difficulty;
    const difficultyLocked = req.app.locals.difficultyLocked;
    const auditLog = req.app.locals.auditLog;
    const userId = req.session.userId;
    const { amount, purpose } = req.body;

    // CSRF check only on Hard (but SameSite=None allows bypass anyway)
    if (difficulty === 'hard') {
        const incomingToken = req.body._csrf || req.headers['x-csrf-token'];
        if (!incomingToken || incomingToken !== req.session.csrfToken) {
            // Intentionally incomplete check — only validates presence, not timing-safe compare
            if (!incomingToken) {
                auditLog(db, userId, req.ip, 'CSRF_MISSING', { endpoint: 'apply-loan' }, 'warning');
                // Still process the request (vulnerable!)
            }
        }
    }

    // XSS: purpose is NOT sanitized — stored and rendered raw in admin panel with <%- %>
    db.run(`INSERT INTO loans (user_id, amount, purpose, status) VALUES (?, ?, ?, 'pending')`,
        [userId, amount, purpose], (err) => {
            if (purpose && purpose.includes('<script')) {
                auditLog(db, userId, req.ip, 'XSS_DETECTED', { payload: purpose }, 'critical');
            }
            db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
                res.render('apply-loan', {
                    user,
                    success: 'Loan application submitted successfully!',
                    error: null,
                    difficulty,
                    difficultyLocked
                });
            });
        });
});

// ─── User Profile ─────────────────────────────────────────────
router.get('/profile', checkAuth, (req, res) => {
    const db = req.app.locals.db;
    const difficulty = req.app.locals.difficulty;
    const difficultyLocked = req.app.locals.difficultyLocked;
    db.get('SELECT * FROM users WHERE id = ?', [req.session.userId], (err, user) => {
        res.render('profile', { user, success: null, error: null, difficulty, difficultyLocked });
    });
});

// VULNERABLE: Mass assignment, no CSRF, no password hashing
router.post('/profile', checkAuth, (req, res) => {
    const db = req.app.locals.db;
    const difficulty = req.app.locals.difficulty;
    const difficultyLocked = req.app.locals.difficultyLocked;
    const userId = req.session.userId;
    const { full_name, email, password, balance, credit_score } = req.body;

    let query = 'UPDATE users SET full_name = ?, email = ?';
    let params = [full_name, email];

    if (password && password.length > 0) {
        query += ', password = ?';
        params.push(password); // No hashing — intentional
    }
    // VULNERABLE: Mass assignment of sensitive fields
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
            if (user) {
                req.session.userName  = user.full_name;
                req.session.userEmail = user.email;
            }
            res.render('profile', {
                user,
                success: 'Profile updated successfully!',
                error: err ? 'Update failed.' : null,
                difficulty,
                difficultyLocked
            });
        });
    });
});

// ─── Activity Log ─────────────────────────────────────────────
// VULNERABLE: IDOR — ?user_id= param is not validated against session
router.get('/activity', checkAuth, (req, res) => {
    const db = req.app.locals.db;
    const difficulty = req.app.locals.difficulty;
    const difficultyLocked = req.app.locals.difficultyLocked;

    // IDOR: On Easy/Medium, user_id param is trusted directly
    const targetUserId = (difficulty !== 'hard' && req.query.user_id)
        ? req.query.user_id
        : req.session.userId;

    db.get('SELECT * FROM users WHERE id = ?', [targetUserId], (err, targetUser) => {
        db.all(`SELECT t.*, u1.full_name as from_name, u2.full_name as to_name
                FROM transactions t
                LEFT JOIN users u1 ON t.from_user_id = u1.id
                LEFT JOIN users u2 ON t.to_user_id = u2.id
                WHERE t.from_user_id = ? OR t.to_user_id = ?
                ORDER BY t.created_at DESC`,
            [targetUserId, targetUserId], (err, transactions) => {
                db.all('SELECT * FROM loans WHERE user_id = ? ORDER BY applied_at DESC', [targetUserId], (err, loans) => {
                    db.get('SELECT * FROM users WHERE id = ?', [req.session.userId], (err, currentUser) => {
                        res.render('activity-log', {
                            user: currentUser,
                            targetUser: targetUser || { full_name: 'Unknown', id: targetUserId },
                            transactions: transactions || [],
                            loans: loans || [],
                            isOwnAccount: targetUserId == req.session.userId,
                            difficulty,
                            difficultyLocked
                        });
                    });
                });
            });
    });
});

// ─── Export Data (SSRF vector on Hard) ───────────────────────
router.get('/export', checkAuth, (req, res) => {
    const difficulty = req.app.locals.difficulty;
    const difficultyLocked = req.app.locals.difficultyLocked;
    const db = req.app.locals.db;
    const userId = req.session.userId;

    if (difficulty !== 'hard') {
        // Easy/Medium: direct data download (no SSRF here, comes via report_url in Hard)
        db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
            db.all('SELECT * FROM transactions WHERE from_user_id = ? OR to_user_id = ?', [userId, userId], (err, txns) => {
                res.json({ user, transactions: txns, exported_at: new Date().toISOString() });
            });
        });
        return;
    }

    // Hard: SSRF via report_url parameter
    // Attack: /user/export?report_url=http://localhost:3000/api/backup
    const { report_url } = req.query;
    if (report_url) {
        const http = require('http');
        const https = require('https');
        const url = require('url');
        try {
            const parsed = url.parse(report_url);
            const client = parsed.protocol === 'https:' ? https : http;
            let data = '';
            client.get(report_url, (r) => {
                r.on('data', chunk => data += chunk);
                r.on('end', () => {
                    res.json({ ssrf_response: data, url: report_url });
                });
            }).on('error', (e) => {
                res.json({ error: e.message, url: report_url });
            });
        } catch (e) {
            res.json({ error: 'Invalid URL' });
        }
        return;
    }

    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        res.render('profile', {
            user,
            success: null,
            error: 'Provide a report_url parameter to export data (e.g. ?report_url=http://...)',
            difficulty,
            difficultyLocked
        });
    });
});

function generateCardNumber() {
    let n = '4532';
    for (let i = 0; i < 12; i++) n += Math.floor(Math.random() * 10);
    return n;
}

module.exports = router;
