const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'banking.db');

// Remove existing database
if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('Removed existing database');
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Create users table
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create credit_cards table
    db.run(`
        CREATE TABLE credit_cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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

    // Create loans table
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

    // Create transactions table
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

    console.log('Database tables created successfully');

    // Insert admin user
    db.run(`
        INSERT INTO users (email, password, full_name, account_number, balance, credit_score, is_admin)
        VALUES ('admin@rdfincorp.com', 'admin123', 'Administrator', 'RDFC-1000-0000-0001', 50000.00, 850, 1)
    `, function (err) {
        if (err) {
            console.error('Error creating admin:', err);
            return;
        }

        const adminId = this.lastID;

        // Create admin credit card
        db.run(`
            INSERT INTO credit_cards (user_id, card_number, cvv, expiry_date, card_type, credit_limit, status)
            VALUES (?, '5495738137592321', '123', '12/28', 'platinum', 50000.00, 'active')
        `, adminId);

        console.log('Admin user created');
    });

    // Insert test users
    const testUsers = [
        {
            email: 'john.doe@example.com',
            password: 'password123',
            fullName: 'John Doe',
            accountNumber: 'RDFC-2000-1234-5678',
            balance: 15000.00,
            creditScore: 720
        },
        {
            email: 'jane.smith@example.com',
            password: 'password123',
            fullName: 'Jane Smith',
            accountNumber: 'RDFC-2000-8765-4321',
            balance: 8500.50,
            creditScore: 680
        },
        {
            email: 'bob.wilson@example.com',
            password: 'password123',
            fullName: 'Bob Wilson',
            accountNumber: 'RDFC-2000-5555-6666',
            balance: 12300.75,
            creditScore: 590
        }
    ];

    testUsers.forEach((user, index) => {
        db.run(`
            INSERT INTO users (email, password, full_name, account_number, balance, credit_score, is_admin)
            VALUES (?, ?, ?, ?, ?, ?, 0)
        `, [user.email, user.password, user.fullName, user.accountNumber, user.balance, user.creditScore], function (err) {
            if (err) {
                console.error('Error creating user:', err);
                return;
            }

            const userId = this.lastID;
            const cardNumber = `4532${String(userId).padStart(4, '0')}${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
            const cvv = String(Math.floor(Math.random() * 900) + 100);
            const cardType = user.creditScore > 700 ? 'gold' : 'silver';
            const creditLimit = user.creditScore > 700 ? 10000 : 5000;

            // Create basic credit card for each user
            db.run(`
                INSERT INTO credit_cards (user_id, card_number, cvv, expiry_date, card_type, credit_limit, status)
                VALUES (?, ?, ?, '06/27', ?, ?, 'active')
            `, [userId, cardNumber, cvv, cardType, creditLimit]);

            console.log(`Test user ${user.email} created`);
        });
    });

    // Insert sample transactions (after user creation completes)
    setTimeout(() => {
        db.run(`
            INSERT INTO transactions (from_user_id, to_user_id, amount, transaction_type, notes)
            VALUES (2, 3, 500.00, 'transfer', 'Rent payment')
        `);

        db.run(`
            INSERT INTO transactions (from_user_id, to_user_id, amount, transaction_type, notes)
            VALUES (3, 4, 250.00, 'transfer', 'Dinner split')
        `);

        db.run(`
            INSERT INTO transactions (from_user_id, to_user_id, amount, transaction_type, notes)
            VALUES (4, 2, 1000.00, 'transfer', 'Loan repayment')
        `);

        console.log('Sample transactions created');

        // Insert sample loan applications (after transactions)
        db.run(`
            INSERT INTO loans (user_id, amount, purpose, status)
            VALUES (3, 25000.00, 'Home renovation', 'pending')
        `);

        db.run(`
            INSERT INTO loans (user_id, amount, purpose, status, admin_notes, reviewed_at)
            VALUES (2, 15000.00, 'Car purchase', 'approved', 'Good credit history', CURRENT_TIMESTAMP)
        `, (err) => {
            console.log('Sample loan applications created');

            // Close database only after all operations complete
            db.close(() => {
                console.log('Database initialization complete!');
                process.exit(0);
            });
        });
    }, 1000);
});
