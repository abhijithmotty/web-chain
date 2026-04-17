const express = require('express');
const router = express.Router();

// ─────────────────────────────────────────────────────────────
//  Admin auth — with no-cache header fix
// ─────────────────────────────────────────────────────────────
function checkAdmin(req, res, next) {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    if (req.session && req.session.loggedIn) {
        if (req.session.isAdmin) {
            return next();
        }
        // Logged-in regular user tried to reach admin area (e.g. via Back button after role switch)
        // Send them to their own dashboard, not a raw 403
        return res.redirect('/user/dashboard');
    }
    res.redirect('/auth/login');
}

// ─── Admin Dashboard ──────────────────────────────────────────
router.get('/dashboard', checkAdmin, (req, res) => {
    const db = req.app.locals.db;
    const difficulty = req.app.locals.difficulty;
    const difficultyLocked = req.app.locals.difficultyLocked;

    db.all('SELECT * FROM users ORDER BY id', (err, users) => {
        db.all(`SELECT l.*, u.full_name, u.email, u.credit_score FROM loans l JOIN users u ON l.user_id = u.id WHERE l.status = 'pending'`, (err, pendingLoans) => {
            db.all(`SELECT c.*, u.full_name, u.email, u.credit_score FROM credit_cards c JOIN users u ON c.user_id = u.id WHERE c.status = 'pending'`, (err, pendingCards) => {
                db.all(`SELECT t.*, u1.full_name as from_name, u2.full_name as to_name
                        FROM transactions t
                        LEFT JOIN users u1 ON t.from_user_id = u1.id
                        LEFT JOIN users u2 ON t.to_user_id = u2.id
                        ORDER BY t.created_at DESC LIMIT 20`, (err, transactions) => {
                    db.all(`SELECT al.*, u.full_name FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id ORDER BY al.created_at DESC LIMIT 50`, (err, auditLogs) => {
                        const stats = {
                            totalUsers: users ? users.length : 0,
                            pendingLoans: pendingLoans ? pendingLoans.length : 0,
                            pendingCards: pendingCards ? pendingCards.length : 0,
                            totalTransactions: transactions ? transactions.length : 0,
                            criticalAlerts: auditLogs ? auditLogs.filter(l => l.severity === 'critical').length : 0
                        };
                        res.render('admin', {
                            admin: req.session,
                            stats,
                            users: users || [],
                            pendingLoans: pendingLoans || [],
                            pendingCards: pendingCards || [],
                            transactions: transactions || [],
                            auditLogs: auditLogs || [],
                            difficulty,
                            difficultyLocked
                        });
                    });
                });
            });
        });
    });
});

// ─── Approve / Reject Loan ────────────────────────────────────
// VULNERABLE: No CSRF token check on any difficulty
router.post('/approve-loan/:loanId', checkAdmin, (req, res) => {
    const db = req.app.locals.db;
    const auditLog = req.app.locals.auditLog;
    const { loanId } = req.params;
    const { action, notes } = req.body;
    const status = action === 'approve' ? 'approved' : 'rejected';

    db.get('SELECT * FROM loans WHERE id = ?', [loanId], (err, loan) => {
        if (err || !loan) return res.redirect('/admin/dashboard');

        db.run(`UPDATE loans SET status = ?, admin_notes = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [status, notes || (status === 'approved' ? 'Approved' : 'Rejected'), loanId], (err) => {
                if (status === 'approved') {
                    db.run(`UPDATE users SET balance = balance + ? WHERE id = ?`, [loan.amount, loan.user_id]);
                }
                auditLog(db, req.session.userId, req.ip, `LOAN_${status.toUpperCase()}`, { loanId, amount: loan.amount }, 'info');
                res.redirect('/admin/dashboard');
            });
    });
});

// ─── Approve / Reject Card ────────────────────────────────────
router.post('/approve-card/:cardId', checkAdmin, (req, res) => {
    const db = req.app.locals.db;
    const auditLog = req.app.locals.auditLog;
    const { cardId } = req.params;
    const { action } = req.body;
    const status = action === 'approve' ? 'active' : 'rejected';

    db.run(`UPDATE credit_cards SET status = ? WHERE id = ?`, [status, cardId], (err) => {
        auditLog(db, req.session.userId, req.ip, `CARD_${status.toUpperCase()}`, { cardId }, 'info');
        res.redirect('/admin/dashboard');
    });
});

// ─── Create User (Admin) ──────────────────────────────────────
router.post('/create-user', checkAdmin, (req, res) => {
    const db = req.app.locals.db;
    const auditLog = req.app.locals.auditLog;
    const { email, password, full_name, is_admin, balance, credit_score } = req.body;
    const accountNumber = generateAccountNumber();
    const userBalance = parseFloat(balance) || 10000.00;
    const userCreditScore = parseInt(credit_score) || 650;
    const userIsAdmin = is_admin === 'on' ? 1 : 0;

    db.run(`INSERT INTO users (email, password, full_name, account_number, balance, credit_score, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [email, password, full_name, accountNumber, userBalance, userCreditScore, userIsAdmin], function (err) {
            if (err) return res.redirect('/admin/dashboard?error=User+creation+failed');
            const userId = this.lastID;
            const cardNumber = generateCardNumber();
            const cvv = String(Math.floor(Math.random() * 900) + 100);

            db.run(`INSERT INTO credit_cards (user_id, card_number, cvv, expiry_date, card_type, credit_limit, status) VALUES (?, ?, ?, '12/28', 'basic', 5000.00, 'active')`,
                [userId, cardNumber, cvv]);

            auditLog(db, req.session.userId, req.ip, 'USER_CREATED', { email, is_admin: userIsAdmin }, 'info');
            res.redirect('/admin/dashboard?success=User+created+successfully');
        });
});

// ─── Set Difficulty (Admin — can also lock) ──────────────────
router.post('/set-difficulty', checkAdmin, (req, res) => {
    const db = req.app.locals.db;
    const auditLog = req.app.locals.auditLog;
    const { level, lock } = req.body;
    const validLevels = ['easy', 'medium', 'hard'];

    if (!validLevels.includes(level)) {
        return res.json({ error: 'Invalid difficulty level' });
    }

    db.run("UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'difficulty'", [level], (err) => {
        if (err) return res.json({ error: 'Failed to update difficulty' });
        req.app.locals.difficulty = level;

        const lockValue = lock === 'true' || lock === '1' ? '1' : '0';
        db.run("UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'difficulty_locked'", [lockValue], () => {
            req.app.locals.difficultyLocked = lockValue === '1';
            auditLog(db, req.session.userId, req.ip, 'DIFFICULTY_CHANGED', { level, locked: lockValue }, 'info');
            res.json({ success: true, level, locked: lockValue === '1' });
        });
    });
});

// ─── Reset DB (Admin only) ────────────────────────────────────
router.post('/reset-db', checkAdmin, (req, res) => {
    const { exec } = require('child_process');
    exec('node init-db.js', { cwd: __dirname.replace('/routes', '') }, (err, stdout, stderr) => {
        if (err) return res.json({ error: stderr });
        res.json({ success: true, message: 'Database reset. Please restart the server.' });
    });
});

// ─── Helpers ─────────────────────────────────────────────────
function generateAccountNumber() {
    return `RDFC-${rnd()}-${rnd()}-${rnd()}`;
}
function rnd() { return String(Math.floor(Math.random() * 10000)).padStart(4, '0'); }
function generateCardNumber() {
    let n = '4532';
    for (let i = 0; i < 12; i++) n += Math.floor(Math.random() * 10);
    return n;
}

module.exports = router;
