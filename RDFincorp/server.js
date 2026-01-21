const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const db = new sqlite3.Database(path.join(__dirname, 'database', 'banking.db'), (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
    } else {
        console.log('Connected to SQLite database');

        // Check if tables exist, if not initialize
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
            if (!row) {
                console.log('Tables not found, initializing database...');
                require('./init-db');
            }
        });
    }
});

// Make db available globally
app.locals.db = db;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

// INTENTIONALLY INSECURE SESSION CONFIGURATION
app.use(session({
    secret: 'insecure-secret-key-123', // Weak secret
    resave: true,
    saveUninitialized: true,
    cookie: {
        secure: false, // Allow over HTTP
        httpOnly: false, // Allow JavaScript access (XSS vulnerable)
        maxAge: null // No expiration
    }
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

// Use routes
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);

// Home route - redirect to login
app.get('/', (req, res) => {
    if (req.session.userId) {
        if (req.session.isAdmin) {
            res.redirect('/admin/dashboard');
        } else {
            res.redirect('/user/dashboard');
        }
    } else {
        res.redirect('/auth/login');
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

app.listen(PORT, () => {
    console.log(`RDFincorp Banking Application running on http://localhost:${PORT}`);
    console.log('⚠️  WARNING: This application is INTENTIONALLY VULNERABLE');
    console.log('⚠️  Use only in isolated environments for security training');
});

module.exports = app;
