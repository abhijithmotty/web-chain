const express = require('express');
const router = express.Router();

// ─── Session check (always auth-required — used by BFCache fix) ───
// Returns 200 if logged in, 401 if not — regardless of difficulty
router.get('/session-check', (req, res) => {
    if (req.session && req.session.userId && req.session.loggedIn) {
        res.json({ authenticated: true, userId: req.session.userId });
    } else {
        res.status(401).json({ authenticated: false });
    }
});

// ─────────────────────────────────────────────────────────────
//  Auth check for API (intentionally varies by difficulty)
// ─────────────────────────────────────────────────────────────
function apiAuth(req, res, next) {
    // Easy/Medium: API is fully open (no auth required)
    const difficulty = req.app.locals.difficulty;
    if (difficulty === 'easy' || difficulty === 'medium') {
        return next();
    }
    // Hard: requires session but still has IDOR
    if (req.session && req.session.userId) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
}

// ─────────────────────────────────────────────────────────────
//  IDOR: GET /api/user/:userId
//  Easy: integer ID
//  Medium: base64-encoded ID (decode to get real ID)
//  Hard: UUID-based (but UUID v1 is predictable)
// ─────────────────────────────────────────────────────────────
router.get('/user/:userId', apiAuth, (req, res) => {
    const db = req.app.locals.db;
    const difficulty = req.app.locals.difficulty;
    let userId = req.params.userId;

    if (difficulty === 'medium') {
        // IDOR via base64 — decode to get real ID
        try { userId = Buffer.from(userId, 'base64').toString('utf8'); } catch (e) { /* use raw */ }
    } else if (difficulty === 'hard') {
        // IDOR via UUID — look up by uuid column
        db.get('SELECT * FROM users WHERE id = (SELECT user_id FROM credit_cards WHERE uuid = ? LIMIT 1)', [userId], (err, user) => {
            if (err || !user) return res.status(404).json({ error: 'User not found' });
            // VULNERABLE: Returns full user record including password hash
            return res.json(user);
        });
        return;
    }

    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(404).json({ error: 'User not found' });
        // VULNERABLE: Exposes password field
        res.json(user);
    });
});

// ─── GET /api/user-id-hint — leaks all user IDs (Easy) ───────
router.get('/user-id-hint', apiAuth, (req, res) => {
    const db = req.app.locals.db;
    const difficulty = req.app.locals.difficulty;

    if (difficulty === 'easy') {
        db.all('SELECT id, full_name, email FROM users', (err, users) => {
            res.json(users || []);
        });
    } else if (difficulty === 'medium') {
        db.all('SELECT id, full_name FROM users', (err, users) => {
            // Return IDs as base64
            const result = (users || []).map(u => ({
                name: u.full_name,
                id_encoded: Buffer.from(String(u.id)).toString('base64')
            }));
            res.json(result);
        });
    } else {
        res.status(403).json({ error: 'Not available on Hard mode. Use UUID-based IDOR.' });
    }
});

// ─── IDOR: GET /api/transactions/:userId ─────────────────────
router.get('/transactions/:userId', apiAuth, (req, res) => {
    const db = req.app.locals.db;
    const difficulty = req.app.locals.difficulty;
    let userId = req.params.userId;

    if (difficulty === 'medium') {
        try { userId = Buffer.from(userId, 'base64').toString('utf8'); } catch (e) {}
    }

    db.all(`SELECT t.*, u1.full_name as from_name, u1.account_number as from_account,
                   u2.full_name as to_name, u2.account_number as to_account
            FROM transactions t
            LEFT JOIN users u1 ON t.from_user_id = u1.id
            LEFT JOIN users u2 ON t.to_user_id = u2.id
            WHERE t.from_user_id = ? OR t.to_user_id = ?
            ORDER BY t.created_at DESC`, [userId, userId], (err, transactions) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(transactions || []);
    });
});

// ─── IDOR: GET /api/cards/:userId ────────────────────────────
router.get('/cards/:userId', apiAuth, (req, res) => {
    const db = req.app.locals.db;
    const difficulty = req.app.locals.difficulty;
    let userId = req.params.userId;

    if (difficulty === 'medium') {
        try { userId = Buffer.from(userId, 'base64').toString('utf8'); } catch (e) {}
    }

    db.all('SELECT * FROM credit_cards WHERE user_id = ?', [userId], (err, cards) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        // VULNERABLE: Returns CVV and full card details
        res.json(cards || []);
    });
});

// ─── IDOR: GET /api/card/:cardId ─────────────────────────────
router.get('/card/:cardId', apiAuth, (req, res) => {
    const db = req.app.locals.db;
    db.get('SELECT * FROM credit_cards WHERE id = ?', [req.params.cardId], (err, card) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!card) return res.status(404).json({ error: 'Card not found' });
        res.json(card);
    });
});

// ─── IDOR: GET /api/loan/:loanId ─────────────────────────────
router.get('/loan/:loanId', apiAuth, (req, res) => {
    const db = req.app.locals.db;
    db.get(`SELECT l.*, u.full_name, u.email, u.credit_score FROM loans l JOIN users u ON l.user_id = u.id WHERE l.id = ?`,
        [req.params.loanId], (err, loan) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (!loan) return res.status(404).json({ error: 'Loan not found' });
            res.json(loan);
        });
});

// ─── Transfer ─────────────────────────────────────────────────
// VULNERABLE: CSRF, IDOR — from_user_id from body (not session)
// Easy/Medium: no auth check, any from_user_id accepted
// Hard: needs session but from_user_id still overrideable
router.post('/transfer', (req, res) => {
    const db = req.app.locals.db;
    const auditLog = req.app.locals.auditLog;
    const difficulty = req.app.locals.difficulty;
    const { from_user_id, to_account, amount, notes } = req.body;

    // VULNERABLE: from_user_id is from body, not session (IDOR + CSRF)
    // On Hard only, we do a soft check but still proceed if there's a session
    const sessionUser = req.session && req.session.userId;
    if (difficulty === 'hard' && !sessionUser) {
        return res.status(401).json({ error: 'Login required' });
    }

    if (!from_user_id || !to_account || !amount) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    db.get('SELECT * FROM users WHERE account_number = ?', [to_account], (err, recipient) => {
        if (err || !recipient) return res.status(400).json({ error: 'Recipient account not found' });

        // VULNERABLE: No balance check (can go negative)
        db.run(`INSERT INTO transactions (from_user_id, to_user_id, amount, transaction_type, notes) VALUES (?, ?, ?, 'transfer', ?)`,
            [from_user_id, recipient.id, parseFloat(amount), notes || ''], (err) => {
                if (err) return res.status(500).json({ error: 'Transfer failed' });

                // Update balances (vulnerable to race conditions)
                db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [parseFloat(amount), from_user_id]);
                db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [parseFloat(amount), recipient.id]);

                auditLog(db, from_user_id, req.ip, 'TRANSFER', { to: to_account, amount }, 'info');
                res.json({ success: true, message: `Transferred $${amount} to ${recipient.full_name}` });
            });
    });
});

// ─── SQL Injection in Search ──────────────────────────────────
// Easy/Medium: direct string concat
// Hard: parameterized but second-order SQLi via stored notes
router.get('/search', (req, res) => {
    const db = req.app.locals.db;
    const difficulty = req.app.locals.difficulty;
    const { query } = req.query;

    if (!query) return res.json([]);

    if (difficulty === 'hard') {
        // Parameterized — but results include stored XSS/SQLi from notes
        db.all('SELECT * FROM transactions WHERE notes LIKE ?', [`%${query}%`], (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results || []);
        });
        return;
    }

    // VULNERABLE: Direct string concatenation — SQLi
    const searchQuery = `SELECT * FROM transactions WHERE notes LIKE '%${query}%'`;
    db.all(searchQuery, (err, results) => {
        if (err) return res.status(500).json({ error: err.message, query: searchQuery });
        res.json(results || []);
    });
});

// ─── Exposed Backup Endpoint ──────────────────────────────────
// Easy/Medium: returns all users with passwords
// Hard: still there but returns bcrypt hashes (crackable with hashcat)
router.get('/backup', (req, res) => {
    const db = req.app.locals.db;
    db.all('SELECT * FROM users', (err, users) => {
        db.all('SELECT * FROM credit_cards', (err2, cards) => {
            res.json({
                message: 'RDFincorp Database Backup v2.0',
                exported_at: new Date().toISOString(),
                users: users || [],
                credit_cards: cards || []
            });
        });
    });
});

// ─── Update Profile via API ───────────────────────────────────
// VULNERABLE: Mass assignment including is_admin (privilege escalation)
router.post('/update-profile', (req, res) => {
    const db = req.app.locals.db;
    const userId = req.session ? req.session.userId : req.body.user_id;
    const { full_name, email, balance, credit_score, is_admin } = req.body;

    let updates = [], values = [];
    if (full_name)             { updates.push('full_name = ?');    values.push(full_name); }
    if (email)                 { updates.push('email = ?');        values.push(email); }
    if (balance !== undefined) { updates.push('balance = ?');      values.push(balance); }
    if (credit_score)          { updates.push('credit_score = ?'); values.push(credit_score); }
    if (is_admin !== undefined){ updates.push('is_admin = ?');     values.push(is_admin); } // Privilege escalation

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(userId);
    db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values, (err) => {
        if (err) return res.status(500).json({ error: 'Update failed' });
        res.json({ success: true, message: 'Profile updated' });
    });
});

// ─── Report endpoint (SSRF trigger for Hard mode) ────────────
router.get('/report', (req, res) => {
    const difficulty = req.app.locals.difficulty;
    if (difficulty !== 'hard') {
        return res.json({ message: 'This endpoint is only available on Hard difficulty.' });
    }
    const { url } = req.query;
    if (!url) return res.json({ error: 'Provide ?url= parameter' });

    const http = require('http');
    const https = require('https');
    const urlMod = require('url');
    const parsed = urlMod.parse(url);
    const client = parsed.protocol === 'https:' ? https : http;
    let data = '';
    client.get(url, (r) => {
        r.on('data', chunk => data += chunk);
        r.on('end', () => res.json({ url, response: data }));
    }).on('error', (e) => res.json({ error: e.message }));
});

module.exports = router;
