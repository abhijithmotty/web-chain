const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'banking.db');

// Remove existing database to start fresh
if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('Removed existing database');
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Users table
    db.run(`
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT NOT NULL,
            account_number TEXT UNIQUE NOT NULL,
            balance REAL DEFAULT 10000.00,
            credit_score INTEGER DEFAULT 650,
            is_admin BOOLEAN DEFAULT 0,
            is_locked BOOLEAN DEFAULT 0,
            failed_logins INTEGER DEFAULT 0,
            last_login DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Credit cards table
    db.run(`
        CREATE TABLE credit_cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT UNIQUE,
            user_id INTEGER NOT NULL,
            card_number TEXT NOT NULL,
            cvv TEXT NOT NULL,
            expiry_date TEXT NOT NULL,
            card_type TEXT NOT NULL,
            credit_limit REAL NOT NULL,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Loans table
    db.run(`
        CREATE TABLE loans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            purpose TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            admin_notes TEXT,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            reviewed_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Transactions table
    db.run(`
        CREATE TABLE transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_user_id INTEGER,
            to_user_id INTEGER,
            amount REAL NOT NULL,
            transaction_type TEXT NOT NULL,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (from_user_id) REFERENCES users(id),
            FOREIGN KEY (to_user_id) REFERENCES users(id)
        )
    `);

    // Activity/Audit log table
    db.run(`
        CREATE TABLE audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            ip_address TEXT,
            action TEXT NOT NULL,
            payload TEXT,
            severity TEXT DEFAULT 'info',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Settings table (key-value)
    db.run(`
        CREATE TABLE settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Password reset tokens table
    db.run(`
        CREATE TABLE password_reset_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT NOT NULL,
            used BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    console.log('Database tables created successfully');

    // Default settings
    db.run(`INSERT INTO settings (key, value) VALUES ('difficulty', 'easy')`);
    db.run(`INSERT INTO settings (key, value) VALUES ('difficulty_locked', '0')`);
    db.run(`INSERT INTO settings (key, value) VALUES ('allow_registration', '1')`);
    db.run(`INSERT INTO settings (key, value) VALUES ('maintenance_mode', '0')`);

    // Seed autoincrement so IDs start from 1000 (more realistic, less guessable)
    // sqlite_sequence is auto-created by SQLite on first AUTOINCREMENT insert.
    // Strategy: dummy insert → update sequence → delete dummy → real inserts start at 1001+
    db.run(`INSERT INTO users (email, password, full_name, account_number, balance, credit_score) VALUES ('_dummy_', '_', '_', '_', 0, 0)`);
    db.run(`INSERT INTO credit_cards (user_id, card_number, cvv, expiry_date, card_type, credit_limit) VALUES (1, '_', '_', '_', 'basic', 0)`);
    db.run(`INSERT INTO loans (user_id, amount, purpose) VALUES (1, 0, '_')`);
    db.run(`INSERT INTO transactions (from_user_id, to_user_id, amount, transaction_type) VALUES (1, 1, 0, 'transfer')`);
    db.run(`INSERT INTO audit_logs (action) VALUES ('_')`);
    db.run(`UPDATE sqlite_sequence SET seq = 1000 WHERE name = 'users'`);
    db.run(`UPDATE sqlite_sequence SET seq = 1000 WHERE name = 'credit_cards'`);
    db.run(`UPDATE sqlite_sequence SET seq = 1000 WHERE name = 'loans'`);
    db.run(`UPDATE sqlite_sequence SET seq = 1000 WHERE name = 'transactions'`);
    db.run(`UPDATE sqlite_sequence SET seq = 1000 WHERE name = 'audit_logs'`);
    db.run(`DELETE FROM users WHERE email = '_dummy_'`);
    db.run(`DELETE FROM credit_cards WHERE card_number = '_'`);
    db.run(`DELETE FROM loans WHERE purpose = '_'`);
    db.run(`DELETE FROM transactions WHERE amount = 0`);
    db.run(`DELETE FROM audit_logs WHERE action = '_'`);

    db.run(`
        INSERT INTO users (email, password, full_name, account_number, balance, credit_score, is_admin)
        VALUES ('admin@rdfincorp.com', 'admin123', 'Administrator', 'RDFC-1000-0000-0001', 50000.00, 850, 1)
    `, function (err) {
        if (err) { console.error('Error creating admin:', err); return; }
        const adminId = this.lastID;
        const adminUuid = generateUUIDv1();
        db.run(`
            INSERT INTO credit_cards (uuid, user_id, card_number, cvv, expiry_date, card_type, credit_limit, status)
            VALUES (?, ?, '5495738137592321', '123', '12/28', 'platinum', 50000.00, 'active')
        `, [adminUuid, adminId]);
        console.log('Admin user created');
    });

    // Test users
    const testUsers = [
        { email: 'john.doe@example.com',   password: 'password123', fullName: 'John Doe',    account: 'RDFC-2000-1234-5678', balance: 15000.00, credit: 720 },
        { email: 'jane.smith@example.com', password: 'password123', fullName: 'Jane Smith',  account: 'RDFC-2000-8765-4321', balance: 8500.50,  credit: 680 },
        { email: 'bob.wilson@example.com', password: 'password123', fullName: 'Bob Wilson',  account: 'RDFC-2000-5555-6666', balance: 12300.75, credit: 590 },
        { email: 'alice.chen@example.com', password: 'letmein',     fullName: 'Alice Chen',  account: 'RDFC-2000-7777-8888', balance: 22000.00, credit: 760 }
    ];

    testUsers.forEach((user) => {
        db.run(`
            INSERT INTO users (email, password, full_name, account_number, balance, credit_score, is_admin)
            VALUES (?, ?, ?, ?, ?, ?, 0)
        `, [user.email, user.password, user.fullName, user.account, user.balance, user.credit], function (err) {
            if (err) { console.error('Error creating user:', err); return; }
            const userId = this.lastID;
            const cardNumber = `4532${String(userId).padStart(4, '0')}${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
            const cvv = String(Math.floor(Math.random() * 900) + 100);
            const cardType = user.credit > 700 ? 'gold' : 'silver';
            const creditLimit = user.credit > 700 ? 10000 : 5000;
            const cardUuid = generateUUIDv1();
            db.run(`
                INSERT INTO credit_cards (uuid, user_id, card_number, cvv, expiry_date, card_type, credit_limit, status)
                VALUES (?, ?, ?, ?, '06/28', ?, ?, 'active')
            `, [cardUuid, userId, cardNumber, cvv, cardType, creditLimit]);
            console.log(`Test user ${user.email} created`);
        });
    });

    // Sample data (after user creation)
    setTimeout(() => {
        // Transactions
        db.run(`INSERT INTO transactions (from_user_id, to_user_id, amount, transaction_type, notes) VALUES (2, 3, 500.00, 'transfer', 'Rent payment')`);
        db.run(`INSERT INTO transactions (from_user_id, to_user_id, amount, transaction_type, notes) VALUES (3, 4, 250.00, 'transfer', 'Dinner split')`);
        db.run(`INSERT INTO transactions (from_user_id, to_user_id, amount, transaction_type, notes) VALUES (4, 2, 1000.00, 'transfer', 'Loan repayment')`);
        db.run(`INSERT INTO transactions (from_user_id, to_user_id, amount, transaction_type, notes) VALUES (5, 2, 3000.00, 'transfer', 'Business payment')`);
        db.run(`INSERT INTO transactions (from_user_id, to_user_id, amount, transaction_type, notes) VALUES (2, 5, 150.00, 'transfer', 'Coffee subscription')`);

        // Loans
        db.run(`INSERT INTO loans (user_id, amount, purpose, status) VALUES (3, 25000.00, 'Home renovation project', 'pending')`);
        db.run(`INSERT INTO loans (user_id, amount, purpose, status, admin_notes, reviewed_at) VALUES (2, 15000.00, 'Car purchase', 'approved', 'Good credit history', CURRENT_TIMESTAMP)`);
        db.run(`INSERT INTO loans (user_id, amount, purpose, status, admin_notes, reviewed_at) VALUES (4, 50000.00, 'Business expansion', 'pending', NULL, NULL)`);
        db.run(`INSERT INTO loans (user_id, amount, purpose, status, admin_notes, reviewed_at) VALUES (3, 5000.00, 'Medical expenses', 'rejected', 'Insufficient income documentation', CURRENT_TIMESTAMP)`);

        // Audit logs (sample attack payloads for realism)
        db.run(`INSERT INTO audit_logs (user_id, ip_address, action, payload, severity) VALUES (NULL, '192.168.1.101', 'FAILED_LOGIN', '{"email":"admin@rdfincorp.com","password":"admin"}', 'warning')`);
        db.run(`INSERT INTO audit_logs (user_id, ip_address, action, payload, severity) VALUES (NULL, '10.0.0.15', 'FAILED_LOGIN', '{"email":"admin@rdfincorp.com OR 1=1--","password":"x"}', 'critical')`);
        db.run(`INSERT INTO audit_logs (user_id, ip_address, action, payload, severity) VALUES (2, '192.168.1.102', 'LOGIN_SUCCESS', '{"email":"john.doe@example.com"}', 'info')`);

        console.log('Sample data created');

        db.close(() => {
            console.log('✅ Database initialization complete!');
            process.exit(0);
        });
    }, 1200);
});

// Generate UUID v1 (time-based, predictable - intentional vulnerability for Hard mode IDOR)
function generateUUIDv1() {
    const now = Date.now();
    const hex = now.toString(16).padStart(12, '0');
    const rand = Math.floor(Math.random() * 0xFFFF).toString(16).padStart(4, '0');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-1${rand.slice(0,3)}-${(Math.floor(Math.random()*4)+8).toString(16)}${rand.slice(1)}-${Math.floor(Math.random()*0xFFFFFFFFFFFF).toString(16).padStart(12,'0')}`;
}
