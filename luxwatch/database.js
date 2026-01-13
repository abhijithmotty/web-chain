const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'watches.db');
const db = new sqlite3.Database(dbPath);

// Initialize database with vulnerable schema
function initializeDatabase() {
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Products table
    db.run(`CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      brand TEXT,
      description TEXT,
      price REAL NOT NULL,
      image TEXT,
      stock INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Orders table
    db.run(`CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      product_id INTEGER,
      quantity INTEGER DEFAULT 1,
      total_price REAL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    // Reviews table (vulnerable to XSS)
    db.run(`CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      user_id INTEGER,
      username TEXT,
      rating INTEGER,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Sessions table (weak session management)
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      session_token TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Seed default users (VULNERABLE: plain text passwords)
    db.run(`INSERT OR IGNORE INTO users (id, username, password, email, role) 
            VALUES (1, 'admin', 'admin123', 'admin@luxwatches.com', 'admin')`);
    
    db.run(`INSERT OR IGNORE INTO users (id, username, password, email, role) 
            VALUES (2, 'user', 'user123', 'user@example.com', 'user')`);
    
    db.run(`INSERT OR IGNORE INTO users (id, username, password, email, role) 
            VALUES (3, 'john', 'password', 'john@example.com', 'user')`);

    // Seed luxury watch products
    const products = [
      ['Rolex Submariner', 'Rolex', 'Iconic dive watch with date display, 41mm case, automatic movement', 12500.00, 'rolex-submariner.jpg', 5],
      ['Omega Speedmaster', 'Omega', 'Legendary moonwatch, chronograph function, manual wind', 6800.00, 'omega-speedmaster.jpg', 8],
      ['Patek Philippe Nautilus', 'Patek Philippe', 'Luxury sports watch, ultra-thin automatic, blue dial', 35000.00, 'patek-nautilus.jpg', 2],
      ['Audemars Piguet Royal Oak', 'Audemars Piguet', 'Iconic octagonal bezel, integrated bracelet, automatic', 28000.00, 'ap-royaloak.jpg', 3],
      ['Tag Heuer Carrera', 'Tag Heuer', 'Racing-inspired chronograph, sporty elegance', 4500.00, 'tag-carrera.jpg', 12],
      ['Breitling Navitimer', 'Breitling', 'Aviation chronograph with slide rule bezel', 7200.00, 'breitling-navitimer.jpg', 6],
      ['Cartier Santos', 'Cartier', 'Square case, Roman numerals, luxury bracelet', 7800.00, 'cartier-santos.jpg', 4],
      ['IWC Pilot', 'IWC', 'Classic pilot watch, large crown, excellent legibility', 5400.00, 'iwc-pilot.jpg', 7],
      ['Jaeger-LeCoultre Reverso', 'Jaeger-LeCoultre', 'Reversible case, Art Deco design, manual wind', 8900.00, 'jlc-reverso.jpg', 3],
      ['Panerai Luminor', 'Panerai', 'Bold 44mm case, crown guard, military heritage', 6200.00, 'panerai-luminor.jpg', 5]
    ];

    const stmt = db.prepare(`INSERT OR IGNORE INTO products (name, brand, description, price, image, stock) 
                             VALUES (?, ?, ?, ?, ?, ?)`);
    products.forEach(product => stmt.run(product));
    stmt.finalize();

    console.log('Database initialized with seed data');
  });
}

// VULNERABLE: SQL Injection - No parameterized queries
function vulnerableQuery(query, callback) {
  db.all(query, (err, rows) => {
    if (err) {
      callback(err, null);
    } else {
      callback(null, rows);
    }
  });
}

// VULNERABLE: Login function with SQL injection
function authenticateUser(username, password, callback) {
  // Intentionally vulnerable to SQL injection
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  vulnerableQuery(query, callback);
}

// VULNERABLE: Search with SQL injection
function searchProducts(searchTerm, callback) {
  const query = `SELECT * FROM products WHERE name LIKE '%${searchTerm}%' OR brand LIKE '%${searchTerm}%'`;
  vulnerableQuery(query, callback);
}

// Get all products
function getAllProducts(callback) {
  db.all('SELECT * FROM products ORDER BY created_at DESC', callback);
}

// Get product by ID
function getProductById(id, callback) {
  db.get('SELECT * FROM products WHERE id = ?', [id], callback);
}

// VULNERABLE: Get user by ID (IDOR vulnerability)
function getUserById(id, callback) {
  db.get(`SELECT * FROM users WHERE id = ${id}`, callback);
}

// VULNERABLE: Get order by ID (IDOR vulnerability)
function getOrderById(id, callback) {
  db.get(`SELECT * FROM orders WHERE id = ${id}`, callback);
}

// Get all users (admin only - but no proper auth check)
function getAllUsers(callback) {
  db.all('SELECT id, username, email, role, created_at FROM users', callback);
}

// Create order
function createOrder(userId, productId, quantity, totalPrice, callback) {
  const stmt = db.prepare('INSERT INTO orders (user_id, product_id, quantity, total_price) VALUES (?, ?, ?, ?)');
  stmt.run(userId, productId, quantity, totalPrice, callback);
  stmt.finalize();
}

// Get user orders
function getUserOrders(userId, callback) {
  db.all(`SELECT o.*, p.name, p.brand, p.image, p.price 
          FROM orders o 
          JOIN products p ON o.product_id = p.id 
          WHERE o.user_id = ?`, [userId], callback);
}

// Get all orders (admin)
function getAllOrders(callback) {
  db.all(`SELECT o.*, u.username, p.name as product_name, p.brand 
          FROM orders o 
          JOIN users u ON o.user_id = u.id 
          JOIN products p ON o.product_id = p.id 
          ORDER BY o.created_at DESC`, callback);
}

// VULNERABLE: Add review (XSS vulnerability - no sanitization)
function addReview(productId, userId, username, rating, comment, callback) {
  const stmt = db.prepare('INSERT INTO reviews (product_id, user_id, username, rating, comment) VALUES (?, ?, ?, ?, ?)');
  stmt.run(productId, userId, username, rating, comment, callback);
  stmt.finalize();
}

// Get product reviews
function getProductReviews(productId, callback) {
  db.all('SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC', [productId], callback);
}

// Add product (admin)
function addProduct(name, brand, description, price, image, stock, callback) {
  const stmt = db.prepare('INSERT INTO products (name, brand, description, price, image, stock) VALUES (?, ?, ?, ?, ?, ?)');
  stmt.run(name, brand, description, price, image, stock, callback);
  stmt.finalize();
}

// Update product (admin)
function updateProduct(id, name, brand, description, price, image, stock, callback) {
  const stmt = db.prepare('UPDATE products SET name = ?, brand = ?, description = ?, price = ?, image = ?, stock = ? WHERE id = ?');
  stmt.run(name, brand, description, price, image, stock, id, callback);
  stmt.finalize();
}

// Delete product (admin)
function deleteProduct(id, callback) {
  db.run('DELETE FROM products WHERE id = ?', [id], callback);
}

// Register new user
function registerUser(username, password, email, callback) {
  const stmt = db.prepare('INSERT INTO users (username, password, email) VALUES (?, ?, ?)');
  stmt.run(username, password, email, callback);
  stmt.finalize();
}

// VULNERABLE: Weak session management
function createSession(userId, callback) {
  // Predictable session token (just user ID + timestamp)
  const sessionToken = `${userId}_${Date.now()}`;
  const stmt = db.prepare('INSERT INTO sessions (user_id, session_token) VALUES (?, ?)');
  stmt.run(userId, sessionToken, function(err) {
    callback(err, sessionToken);
  });
  stmt.finalize();
}

// Get session
function getSession(sessionToken, callback) {
  db.get('SELECT * FROM sessions WHERE session_token = ?', [sessionToken], callback);
}

module.exports = {
  db,
  initializeDatabase,
  vulnerableQuery,
  authenticateUser,
  searchProducts,
  getAllProducts,
  getProductById,
  getUserById,
  getOrderById,
  getAllUsers,
  createOrder,
  getUserOrders,
  getAllOrders,
  addReview,
  getProductReviews,
  addProduct,
  updateProduct,
  deleteProduct,
  registerUser,
  createSession,
  getSession
};
