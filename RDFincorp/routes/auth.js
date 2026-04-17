const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// ─── JWT weak secret (Hard mode — intentionally crackable) ───
const JWT_WEAK_SECRET = 'rdf123';

// ─── Helpers ─────────────────────────────────────────────────
function generateAccountNumber() {
    const part2 = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const part3 = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const part4 = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `RDFC-${part2}-${part3}-${part4}`;
}

function generateCardNumber() {
    let n = '4532';
    for (let i = 0; i < 12; i++) n += Math.floor(Math.random() * 10);
    return n;
}

// ─── Predictable CSRF token (Medium — timestamp-based) ───────
function generateCsrfToken(difficulty) {
    if (difficulty === 'easy') return null; // No CSRF protection
    if (difficulty === 'medium') {
        // VULNERABLE: predictable — just a timestamp divided by 1000
        return Math.floor(Date.now() / 1000).toString();
    }
    // Hard: real-looking token but stored in session (SameSite=None allows bypass)
    return crypto.randomBytes(16).toString('hex');
}

// ─── Login Page ───────────────────────────────────────────────
router.get('/login', (req, res) => {
    // If user already has a valid session, redirect them to their appropriate dashboard
    if (req.session && req.session.userId && req.session.loggedIn) {
        return res.redirect(req.session.isAdmin ? '/admin/dashboard' : '/user/dashboard');
    }

    const difficulty = req.app.locals.difficulty;
    const difficultyLocked = req.app.locals.difficultyLocked;
    const csrfToken = generateCsrfToken(difficulty);
    if (csrfToken) req.session.csrfToken = csrfToken;

    res.render('login', {
        error: null,
        difficulty,
        difficultyLocked,
        csrfToken
    });
});

// ─── Login POST (difficulty-aware) ───────────────────────────
router.post('/login', (req, res) => {
    const db = req.app.locals.db;
    const auditLog = req.app.locals.auditLog;
    const loginLimiter = req.app.locals.loginLimiter;
    const difficulty = req.app.locals.difficulty;
    const difficultyLocked = req.app.locals.difficultyLocked;
    const { email, password } = req.body;

    // Apply rate limiting for medium/hard
    if (difficulty !== 'easy') {
        loginLimiter(req, res, () => processLogin());
    } else {
        processLogin();
    }

    function processLogin() {
        if (difficulty === 'easy') {
            // ───────────────────────────────────────────────
            // EASY: Raw SQL injection — ' OR '1'='1' --
            // ───────────────────────────────────────────────
            const query = `SELECT * FROM users WHERE email = '${email}' AND password = '${password}'`;
            db.get(query, (err, user) => {
                if (err) {
                    auditLog(db, null, req.ip, 'SQL_ERROR', { query, err: err.message }, 'error');
                    return res.render('login', { error: `DB Error: ${err.message}`, difficulty, difficultyLocked, csrfToken: null });
                }
                handleLoginResult(user, email, query);
            });

        } else if (difficulty === 'medium') {
            // ───────────────────────────────────────────────
            // MEDIUM: Basic filter — blocks ' OR but NOT comment bypass
            // Bypass: ' OR/**/1=1--  or  admin'--
            // ───────────────────────────────────────────────
            const blockedPatterns = [/'\s+OR\s+'/i, /'\s+OR\s+1/i];
            const isBlocked = blockedPatterns.some(p => p.test(email) || p.test(password));

            if (isBlocked) {
                auditLog(db, null, req.ip, 'SQLI_BLOCKED', { email, password }, 'warning');
                return res.render('login', { error: 'Invalid input detected.', difficulty, difficultyLocked, csrfToken: req.session.csrfToken });
            }

            // Still vulnerable to: admin'-- or ' OR/**/1=1--
            const query = `SELECT * FROM users WHERE email = '${email}' AND password = '${password}'`;
            db.get(query, (err, user) => {
                if (err) {
                    auditLog(db, null, req.ip, 'SQL_ERROR', { query, err: err.message }, 'error');
                    return res.render('login', { error: `DB Error: ${err.message}`, difficulty, difficultyLocked, csrfToken: req.session.csrfToken });
                }
                handleLoginResult(user, email, query);
            });

        } else {
            // ───────────────────────────────────────────────
            // HARD: bcrypt + parameterized query BUT JWT none-alg bypass
            // Attack: Forge JWT with {"alg":"none"} and role:admin
            // OR: Blind SQLi via RANDOMBLOB time-based
            // ───────────────────────────────────────────────

            // Check for JWT none-algorithm token in Authorization header
            const authHeader = req.headers['authorization'];
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                try {
                    // VULNERABLE: accepts none algorithm
                    const decoded = jwt.verify(token, JWT_WEAK_SECRET, { algorithms: ['HS256', 'none'] });
                    db.get('SELECT * FROM users WHERE id = ?', [decoded.userId], (err, user) => {
                        if (user) {
                            auditLog(db, user.id, req.ip, 'JWT_LOGIN', { method: 'bearer_token' }, 'info');
                            return establishSession(user, res, req, difficulty, difficultyLocked);
                        }
                        return res.render('login', { error: 'Invalid token.', difficulty, difficultyLocked, csrfToken: req.session.csrfToken });
                    });
                    return;
                } catch (e) {
                    // Fall through to normal login
                }
            }

            // Parameterized query (SQLi via second-order or RANDOMBLOB)
            db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
                if (err || !user) {
                    auditLog(db, null, req.ip, 'FAILED_LOGIN', { email }, 'warning');
                    return res.render('login', { error: 'Invalid credentials.', difficulty, difficultyLocked, csrfToken: req.session.csrfToken });
                }

                // VULNERABLE: bcrypt compare but password is stored as plain in DB by default unless re-hashed
                // This allows a hash-length extension attack if attacker gets the hash via IDOR
                const passwordMatch = bcrypt.compareSync(password, user.password) || (password === user.password);
                if (passwordMatch) {
                    handleLoginResult(user, email, 'parameterized');
                } else {
                    // Track failed attempts (lockout at 10)
                    db.run('UPDATE users SET failed_logins = failed_logins + 1 WHERE id = ?', [user.id]);
                    auditLog(db, user.id, req.ip, 'FAILED_LOGIN', { email }, 'warning');
                    return res.render('login', { error: 'Invalid credentials.', difficulty, difficultyLocked, csrfToken: req.session.csrfToken });
                }
            });
        }
    }

    function handleLoginResult(user, email, query) {
        if (user) {
            auditLog(db, user.id, req.ip, 'LOGIN_SUCCESS', { email, method: 'session' }, 'info');
            db.run('UPDATE users SET failed_logins = 0, last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
            establishSession(user, res, req, difficulty, difficultyLocked);
        } else {
            auditLog(db, null, req.ip, 'FAILED_LOGIN', { email, query }, 'warning');
            res.render('login', {
                error: 'Invalid email or password.',
                difficulty,
                difficultyLocked,
                csrfToken: req.session.csrfToken || null
            });
        }
    }
});

function establishSession(user, res, req, difficulty, difficultyLocked) {
    // Session regeneration prevents session fixation — but we do it here
    req.session.regenerate((err) => {
        req.session.userId    = user.id;
        req.session.userEmail = user.email;
        req.session.userName  = user.full_name;
        req.session.isAdmin   = user.is_admin;
        req.session.loggedIn  = true;

        // VULNERABLE: Sensitive data in cookies (XSS/IDOR target)
        res.cookie('userId',   user.id,        { httpOnly: false });
        res.cookie('isAdmin',  user.is_admin,  { httpOnly: false });
        res.cookie('userName', user.full_name, { httpOnly: false });

        // Hard mode: also issue JWT
        if (difficulty === 'hard') {
            const token = jwt.sign(
                { userId: user.id, email: user.email, role: user.is_admin ? 'admin' : 'user' },
                JWT_WEAK_SECRET,
                { algorithm: 'HS256', expiresIn: '24h' }
            );
            res.cookie('jwt_token', token, { httpOnly: false });
        }

        req.session.save(() => {
            if (user.is_admin) return res.redirect('/admin/dashboard');
            return res.redirect('/user/dashboard');
        });
    });
}

// ─── Register Page ────────────────────────────────────────────
router.get('/register', (req, res) => {
    const difficulty = req.app.locals.difficulty;
    const difficultyLocked = req.app.locals.difficultyLocked;
    res.render('register', { error: null, success: null, difficulty, difficultyLocked });
});

// ─── Register POST ────────────────────────────────────────────
// VULNERABLE: Mass assignment — accepts is_admin, balance, credit_score from body
router.post('/register', (req, res) => {
    const db = req.app.locals.db;
    const difficulty = req.app.locals.difficulty;
    const difficultyLocked = req.app.locals.difficultyLocked;

    let { email, password, full_name, is_admin, balance, credit_score } = req.body;
    const accountNumber = generateAccountNumber();

    // Use defaults if not provided, but ACCEPT malicious values if provided
    balance      = balance      || 10000.00;
    credit_score = credit_score || 650;
    is_admin     = is_admin     || 0;

    // VULNERABLE: No password hashing (Easy/Medium) — plain text stored
    // Hard: bcrypt hash, but Salt is weak (rounds=1)
    let storedPassword = password;
    if (difficulty === 'hard') {
        storedPassword = bcrypt.hashSync(password, 1); // Intentionally fast (rounds=1)
    }

    const query = `INSERT INTO users (email, password, full_name, account_number, balance, credit_score, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.run(query, [email, storedPassword, full_name, accountNumber, balance, credit_score, is_admin], function (err) {
        if (err) {
            return res.render('register', { error: 'Registration failed. Email may already exist.', success: null, difficulty, difficultyLocked });
        }
        const userId = this.lastID;
        const cardNumber = generateCardNumber();
        const cvv = String(Math.floor(Math.random() * 900) + 100);

        db.run(`INSERT INTO credit_cards (user_id, card_number, cvv, expiry_date, card_type, credit_limit, status) VALUES (?, ?, ?, '12/28', 'basic', 5000.00, 'active')`,
            [userId, cardNumber, cvv]);

        res.render('register', {
            error: null,
            success: `Account created! Your account number is ${accountNumber}. <a href="/auth/login">Login now</a>`,
            difficulty,
            difficultyLocked
        });
    });
});

// ─── Logout ───────────────────────────────────────────────────
router.get('/logout', (req, res) => {
    const auditLog = req.app.locals.auditLog;
    const userId = req.session ? req.session.userId : null;

    auditLog(req.app.locals.db, userId, req.ip, 'LOGOUT', {}, 'info');

    // Clear cookies
    res.clearCookie('userId');
    res.clearCookie('isAdmin');
    res.clearCookie('userName');
    res.clearCookie('jwt_token');
    res.clearCookie('connect.sid');

    // Properly destroy session with callback
    req.session.destroy((err) => {
        if (err) console.error('Session destroy error:', err);
        // Send no-cache headers so browser does not cache the redirect
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.redirect('/auth/login');
    });
});

// ─── Forgot Password ─────────────────────────────────────────
router.get('/forgot-password', (req, res) => {
    const difficulty = req.app.locals.difficulty;
    const difficultyLocked = req.app.locals.difficultyLocked;
    res.render('forgot-password', { error: null, success: null, difficulty, difficultyLocked });
});

router.post('/forgot-password', (req, res) => {
    const db = req.app.locals.db;
    const difficulty = req.app.locals.difficulty;
    const difficultyLocked = req.app.locals.difficultyLocked;
    const { email } = req.body;

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        // Always show success (prevents user enumeration — but token is leaked in response for Easy mode)
        if (!user) {
            return res.render('forgot-password', {
                error: null,
                success: 'If that email exists, a reset link has been sent.',
                difficulty,
                difficultyLocked
            });
        }

        // VULNERABLE Easy: Simple numeric token (000000–999999)
        // VULNERABLE Medium: Token has no expiry — can be reused
        // Hard: Token has expiry but is reusable (used flag never set on Easy/Medium)
        const token = difficulty === 'hard'
            ? crypto.randomBytes(20).toString('hex')
            : String(Math.floor(Math.random() * 1000000)).padStart(6, '0');

        db.run(`INSERT INTO password_reset_tokens (user_id, token) VALUES (?, ?)`, [user.id, token]);

        // VULNERABLE on Easy: token is shown directly in the response
        const successMsg = difficulty === 'easy'
            ? `Reset token: <code style="color:#f00;font-size:1.2em">${token}</code> (for demo — use at /auth/reset-password?token=${token})`
            : 'If that email exists, a password reset link has been sent.';

        res.render('forgot-password', { error: null, success: successMsg, difficulty, difficultyLocked });
    });
});

router.get('/reset-password', (req, res) => {
    const difficulty = req.app.locals.difficulty;
    const difficultyLocked = req.app.locals.difficultyLocked;
    const { token } = req.query;
    res.render('reset-password', { error: null, success: null, token, difficulty, difficultyLocked });
});

router.post('/reset-password', (req, res) => {
    const db = req.app.locals.db;
    const difficulty = req.app.locals.difficulty;
    const difficultyLocked = req.app.locals.difficultyLocked;
    const { token, password } = req.body;

    // VULNERABLE: On Easy/Medium — token is never marked as used → reusable
    // Hard: marked as used but no expiry check
    const usedCheck = difficulty === 'hard' ? ' AND used = 0' : '';
    db.get(`SELECT * FROM password_reset_tokens WHERE token = ?${usedCheck}`, [token], (err, resetReq) => {
        if (err || !resetReq) {
            return res.render('reset-password', { error: 'Invalid or expired token.', success: null, token, difficulty, difficultyLocked });
        }

        db.run('UPDATE users SET password = ? WHERE id = ?', [password, resetReq.user_id]);

        if (difficulty === 'hard') {
            db.run('UPDATE password_reset_tokens SET used = 1 WHERE token = ?', [token]);
        }
        // Easy/Medium: token NOT marked as used → can reset again

        res.render('reset-password', {
            error: null,
            success: 'Password reset successfully! <a href="/auth/login">Login now</a>',
            token: null,
            difficulty,
            difficultyLocked
        });
    });
});

// ─── Difficulty Toggle (User-facing) ─────────────────────────
router.post('/set-difficulty', (req, res) => {
    const db = req.app.locals.db;
    const { level } = req.body;
    const validLevels = ['easy', 'medium', 'hard'];

    if (!validLevels.includes(level)) {
        return res.json({ error: 'Invalid difficulty level' });
    }

    // Check if admin has locked the difficulty
    db.get("SELECT value FROM settings WHERE key = 'difficulty_locked'", (err, row) => {
        if (row && row.value === '1') {
            return res.json({ error: 'Difficulty is locked by administrator.' });
        }
        db.run("UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'difficulty'", [level], (err) => {
            if (err) return res.json({ error: 'Failed to update difficulty' });
            req.app.locals.difficulty = level;
            res.json({ success: true, level });
        });
    });
});

module.exports = router;
