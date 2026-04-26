const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────
//  Database
// ─────────────────────────────────────────────
const db = new sqlite3.Database(path.join(__dirname, 'database', 'banking.db'), (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
    } else {
        console.log('Connected to SQLite database');
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
            if (!row) {
                console.log('Tables not found, initializing database...');
                require('./init-db');
            }
        });
    }
});

app.locals.db = db;

// ─────────────────────────────────────────────
//  Middleware
// ─────────────────────────────────────────────
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

// ─────────────────────────────────────────────
//  INTENTIONALLY INSECURE SESSION CONFIGURATION
//  (httpOnly: false allows XSS to steal cookies)
// ─────────────────────────────────────────────
app.use(session({
    secret: 'insecure-secret-key-123',   // Weak secret — intentional
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,      // Allow over HTTP — intentional
        httpOnly: false,    // XSS can steal cookie — intentional
        maxAge: null        // No expiration — intentional
    }
}));

// ─────────────────────────────────────────────
//  Difficulty Middleware
//  Reads current difficulty from DB and attaches
//  to req.app.locals on every request.
// ─────────────────────────────────────────────
app.use((req, res, next) => {
    db.get("SELECT value FROM settings WHERE key = 'difficulty'", (err, row) => {
        app.locals.difficulty = (row && row.value) ? row.value : 'easy';
        db.get("SELECT value FROM settings WHERE key = 'difficulty_locked'", (err2, row2) => {
            app.locals.difficultyLocked = (row2 && row2.value === '1');
            next();
        });
    });
});

// ─────────────────────────────────────────────
//  Rate Limiter (Medium & Hard difficulty)
//  Intentionally bypassable via X-Forwarded-For
// ─────────────────────────────────────────────
const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,   // 5 minutes
    max: 10,
    keyGenerator: (req) => {
        // VULNERABLE: Trusts X-Forwarded-For header — bypass by spoofing
        return req.headers['x-forwarded-for'] || req.ip;
    },
    skip: (req) => {
        // Only apply rate limiting on Medium/Hard
        return app.locals.difficulty === 'easy';
    },
    handler: (req, res) => {
        res.render('login', {
            error: 'Too many login attempts. Please wait 5 minutes.',
            difficulty: app.locals.difficulty,
            difficultyLocked: app.locals.difficultyLocked
        });
    }
});

app.locals.loginLimiter = loginLimiter;

// ─────────────────────────────────────────────
//  No-Cache Middleware for Protected Routes
//  Fixes browser back-button post-logout access
// ─────────────────────────────────────────────
function noCache(req, res, next) {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
    });
    next();
}
app.locals.noCache = noCache;

// ─────────────────────────────────────────────
//  Audit Logger Helper
// ─────────────────────────────────────────────
function auditLog(db, userId, ip, action, payload, severity = 'info') {
    const payloadStr = typeof payload === 'object' ? JSON.stringify(payload) : payload;
    db.run(
        `INSERT INTO audit_logs (user_id, ip_address, action, payload, severity) VALUES (?, ?, ?, ?, ?)`,
        [userId || null, ip, action, payloadStr, severity]
    );
}
app.locals.auditLog = auditLog;

// ─────────────────────────────────────────────
//  Static Files
// ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────
//  View Engine
// ─────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─────────────────────────────────────────────
//  Routes
// ─────────────────────────────────────────────
const authRoutes  = require('./routes/auth');
const userRoutes  = require('./routes/user');
const adminRoutes = require('./routes/admin');
const apiRoutes   = require('./routes/api');

app.use('/auth',  authRoutes);
app.use('/user',  userRoutes);
app.use('/admin', adminRoutes);
app.use('/api',   apiRoutes);

// Home route
app.get('/', (req, res) => {
    if (req.session && req.session.userId) {
        if (req.session.isAdmin) {
            return res.redirect('/admin/dashboard');
        }
        return res.redirect('/user/dashboard');
    }
    res.redirect('/auth/login');
});

// ─────────────────────────────────────────────
//  Error Handler
// ─────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});

app.listen(PORT, () => {
    console.log(`\n🏦 RDFincorp Banking Application running on http://localhost:${PORT}`);
    console.log('⚠️  WARNING: This application is INTENTIONALLY VULNERABLE');
    console.log('⚠️  Use only in isolated environments for security training\n');
});

module.exports = app;
