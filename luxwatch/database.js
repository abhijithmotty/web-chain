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

    // User Addresses table (IDOR vulnerable)
    db.run(`CREATE TABLE IF NOT EXISTS addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT,
      street TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      country TEXT,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Payment Methods table (IDOR vulnerable)
    db.run(`CREATE TABLE IF NOT EXISTS payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      card_type TEXT,
      last_four TEXT,
      expiry_month INTEGER,
      expiry_year INTEGER,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Watch Collections table (IDOR vulnerable)
    db.run(`CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT,
      description TEXT,
      is_public INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Collection Items table
    db.run(`CREATE TABLE IF NOT EXISTS collection_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (collection_id) REFERENCES collections(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    // Wishlists table (IDOR vulnerable)
    db.run(`CREATE TABLE IF NOT EXISTS wishlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT DEFAULT 'My Wishlist',
      is_public INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Wishlist Items table
    db.run(`CREATE TABLE IF NOT EXISTS wishlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wishlist_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (wishlist_id) REFERENCES wishlists(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    // Referrals table (IDOR vulnerable)
    db.run(`CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id INTEGER NOT NULL,
      referred_user_id INTEGER,
      referral_code TEXT UNIQUE,
      earnings REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (referrer_id) REFERENCES users(id),
      FOREIGN KEY (referred_user_id) REFERENCES users(id)
    )`);

    // Order Tracking table (IDOR vulnerable)
    db.run(`CREATE TABLE IF NOT EXISTS order_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      status TEXT,
      location TEXT,
      notes TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id)
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

    // Seed addresses for users
    db.run(`INSERT OR IGNORE INTO addresses (user_id, name, street, city, state, zip, country, is_default) 
            VALUES (1, 'Admin Office', '123 Luxury Ave', 'New York', 'NY', '10001', 'USA', 1)`);
    db.run(`INSERT OR IGNORE INTO addresses (user_id, name, street, city, state, zip, country, is_default) 
            VALUES (2, 'Home', '456 Main St', 'Los Angeles', 'CA', '90001', 'USA', 1)`);
    db.run(`INSERT OR IGNORE INTO addresses (user_id, name, street, city, state, zip, country, is_default) 
            VALUES (3, 'Office', '789 Business Blvd', 'Chicago', 'IL', '60601', 'USA', 0)`);

    // Seed payment methods (tokenized - not real cards)
    db.run(`INSERT OR IGNORE INTO payment_methods (user_id, card_type, last_four, expiry_month, expiry_year, is_default) 
            VALUES (1, 'Visa', '4532', 12, 2027, 1)`);
    db.run(`INSERT OR IGNORE INTO payment_methods (user_id, card_type, last_four, expiry_month, expiry_year, is_default) 
            VALUES (2, 'Mastercard', '8765', 6, 2026, 1)`);
    db.run(`INSERT OR IGNORE INTO payment_methods (user_id, card_type, last_four, expiry_month, expiry_year, is_default) 
            VALUES (3, 'Amex', '1234', 3, 2028, 0)`);

    // Seed collections
    db.run(`INSERT OR IGNORE INTO collections (id, user_id, name, description, is_public) 
            VALUES (1, 1, 'Classic Collection', 'My favorite classic timepieces', 1)`);
    db.run(`INSERT OR IGNORE INTO collections (id, user_id, name, description, is_public) 
            VALUES (2, 2, 'Dream Watches', 'Watches I want to own someday', 0)`);
    db.run(`INSERT OR IGNORE INTO collections (id, user_id, name, description, is_public) 
            VALUES (3, 3, 'Investment Pieces', 'High-value watches for investment', 0)`);

    // Seed collection items
    db.run(`INSERT OR IGNORE INTO collection_items (collection_id, product_id) VALUES (1, 1)`);
    db.run(`INSERT OR IGNORE INTO collection_items (collection_id, product_id) VALUES (1, 3)`);
    db.run(`INSERT OR IGNORE INTO collection_items (collection_id, product_id) VALUES (2, 3)`);
    db.run(`INSERT OR IGNORE INTO collection_items (collection_id, product_id) VALUES (2, 4)`);

    // Seed wishlists
    db.run(`INSERT OR IGNORE INTO wishlists (id, user_id, name, is_public) 
            VALUES (1, 1, 'Admin Wishlist', 0)`);
    db.run(`INSERT OR IGNORE INTO wishlists (id, user_id, name, is_public) 
            VALUES (2, 2, 'My Wishlist', 1)`);

    // Seed wishlist items
    db.run(`INSERT OR IGNORE INTO wishlist_items (wishlist_id, product_id) VALUES (1, 5)`);
    db.run(`INSERT OR IGNORE INTO wishlist_items (wishlist_id, product_id) VALUES (2, 1)`);
    db.run(`INSERT OR IGNORE INTO wishlist_items (wishlist_id, product_id) VALUES (2, 3)`);

    // Seed referrals
    db.run(`INSERT OR IGNORE INTO referrals (referrer_id, referral_code, earnings) 
            VALUES (1, 'ADMIN2024', 150.50)`);
    db.run(`INSERT OR IGNORE INTO referrals (referrer_id, referral_code, earnings) 
            VALUES (2, 'USER2024', 75.25)`);
    db.run(`INSERT OR IGNORE INTO referrals (referrer_id, referred_user_id, referral_code, earnings) 
            VALUES (1, 3, 'ADMIN2024', 50.00)`);

    // Seed some sample orders for demonstration
    db.run(`INSERT OR IGNORE INTO orders (id, user_id, product_id, quantity, total_price, status) 
            VALUES (1, 2, 1, 1, 12500.00, 'shipped')`);
    db.run(`INSERT OR IGNORE INTO orders (id, user_id, product_id, quantity, total_price, status) 
            VALUES (2, 3, 5, 1, 4500.00, 'delivered')`);

    // Seed order tracking
    db.run(`INSERT OR IGNORE INTO order_tracking (order_id, status, location, notes) 
            VALUES (1, 'Shipped', 'Los Angeles Distribution Center', 'Package in transit')`);
    db.run(`INSERT OR IGNORE INTO order_tracking (order_id, status, location, notes) 
            VALUES (2, 'Delivered', 'Chicago - 789 Business Blvd', 'Delivered to recipient')`);

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
  stmt.run(userId, sessionToken, function (err) {
    callback(err, sessionToken);
  });
  stmt.finalize();
}

// Get session
function getSession(sessionToken, callback) {
  db.get('SELECT * FROM sessions WHERE session_token = ?', [sessionToken], callback);
}

// ============= ADDRESS MANAGEMENT (IDOR VULNERABLE) =============

// VULNERABLE: Get user addresses (should check ownership)
function getUserAddresses(userId, callback) {
  db.all('SELECT * FROM addresses WHERE user_id = ?', [userId], callback);
}

// VULNERABLE: Get address by ID (IDOR - no ownership check)
function getAddressById(id, callback) {
  db.get(`SELECT * FROM addresses WHERE id = ${id}`, callback);
}

// Add address
function addAddress(userId, name, street, city, state, zip, country, isDefault, callback) {
  const stmt = db.prepare('INSERT INTO addresses (user_id, name, street, city, state, zip, country, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  stmt.run(userId, name, street, city, state, zip, country, isDefault, callback);
  stmt.finalize();
}

// VULNERABLE: Update address (IDOR - no ownership check)
function updateAddress(id, name, street, city, state, zip, country, isDefault, callback) {
  const stmt = db.prepare('UPDATE addresses SET name = ?, street = ?, city = ?, state = ?, zip = ?, country = ?, is_default = ? WHERE id = ?');
  stmt.run(name, street, city, state, zip, country, isDefault, id, callback);
  stmt.finalize();
}

// VULNERABLE: Delete address (IDOR - no ownership check)
function deleteAddress(id, callback) {
  db.run(`DELETE FROM addresses WHERE id = ${id}`, callback);
}

// ============= PAYMENT METHODS (IDOR VULNERABLE) =============

// Get user payment methods
function getUserPaymentMethods(userId, callback) {
  db.all('SELECT * FROM payment_methods WHERE user_id = ?', [userId], callback);
}

// VULNERABLE: Get payment method by ID (IDOR - no ownership check)
function getPaymentMethodById(id, callback) {
  db.get(`SELECT * FROM payment_methods WHERE id = ${id}`, callback);
}

// Add payment method
function addPaymentMethod(userId, cardType, lastFour, expiryMonth, expiryYear, isDefault, callback) {
  const stmt = db.prepare('INSERT INTO payment_methods (user_id, card_type, last_four, expiry_month, expiry_year, is_default) VALUES (?, ?, ?, ?, ?, ?)');
  stmt.run(userId, cardType, lastFour, expiryMonth, expiryYear, isDefault, callback);
  stmt.finalize();
}

// VULNERABLE: Delete payment method (IDOR - no ownership check)
function deletePaymentMethod(id, callback) {
  db.run(`DELETE FROM payment_methods WHERE id = ${id}`, callback);
}

// ============= COLLECTIONS (IDOR VULNERABLE) =============

// Get user collections
function getUserCollections(userId, callback) {
  db.all('SELECT * FROM collections WHERE user_id = ?', [userId], callback);
}

// VULNERABLE: Get collection by ID (IDOR - can access private collections)
function getCollectionById(id, callback) {
  db.get(`SELECT c.*, u.username 
          FROM collections c 
          JOIN users u ON c.user_id = u.id 
          WHERE c.id = ${id}`, callback);
}

// Get collection items
function getCollectionItems(collectionId, callback) {
  db.all(`SELECT ci.*, p.name, p.brand, p.price, p.image 
          FROM collection_items ci 
          JOIN products p ON ci.product_id = p.id 
          WHERE ci.collection_id = ?`, [collectionId], callback);
}

// Add collection
function addCollection(userId, name, description, isPublic, callback) {
  const stmt = db.prepare('INSERT INTO collections (user_id, name, description, is_public) VALUES (?, ?, ?, ?)');
  stmt.run(userId, name, description, isPublic, callback);
  stmt.finalize();
}

// Add item to collection
function addToCollection(collectionId, productId, callback) {
  const stmt = db.prepare('INSERT INTO collection_items (collection_id, product_id) VALUES (?, ?)');
  stmt.run(collectionId, productId, callback);
  stmt.finalize();
}

// VULNERABLE: Delete collection (IDOR - no ownership check)
function deleteCollection(id, callback) {
  db.run(`DELETE FROM collections WHERE id = ${id}`, callback);
}

// ============= WISHLISTS (IDOR VULNERABLE) =============

// Get user wishlists
function getUserWishlists(userId, callback) {
  db.all('SELECT * FROM wishlists WHERE user_id = ?', [userId], callback);
}

// VULNERABLE: Get wishlist by ID (IDOR - can access private wishlists)
function getWishlistById(id, callback) {
  db.get(`SELECT w.*, u.username 
          FROM wishlists w 
          JOIN users u ON w.user_id = u.id 
          WHERE w.id = ${id}`, callback);
}

// Get wishlist items
function getWishlistItems(wishlistId, callback) {
  db.all(`SELECT wi.*, p.name, p.brand, p.price, p.image 
          FROM wishlist_items wi 
          JOIN products p ON wi.product_id = p.id 
          WHERE wi.wishlist_id = ?`, [wishlistId], callback);
}

// Add wishlist
function addWishlist(userId, name, isPublic, callback) {
  const stmt = db.prepare('INSERT INTO wishlists (user_id, name, is_public) VALUES (?, ?, ?)');
  stmt.run(userId, name, isPublic, callback);
  stmt.finalize();
}

// Add item to wishlist
function addToWishlist(wishlistId, productId, callback) {
  const stmt = db.prepare('INSERT INTO wishlist_items (wishlist_id, product_id) VALUES (?, ?)');
  stmt.run(wishlistId, productId, callback);
  stmt.finalize();
}

// ============= REFERRALS (IDOR VULNERABLE) =============

// VULNERABLE: Get referral stats by user ID (IDOR - can view anyone's earnings)
function getReferralStats(userId, callback) {
  db.get(`SELECT 
            COUNT(*) as total_referrals, 
            SUM(earnings) as total_earnings,
            referral_code
          FROM referrals 
          WHERE referrer_id = ${userId}
          GROUP BY referrer_id, referral_code`, callback);
}

// Get user's referral code
function getUserReferralCode(userId, callback) {
  db.get('SELECT referral_code FROM referrals WHERE referrer_id = ? LIMIT 1', [userId], callback);
}

// ============= ORDER TRACKING (IDOR VULNERABLE) =============

// VULNERABLE: Get order tracking (IDOR - can track anyone's order)
function getOrderTracking(orderId, callback) {
  db.all(`SELECT * FROM order_tracking WHERE order_id = ${orderId} ORDER BY updated_at DESC`, callback);
}

// Add tracking update
function addTrackingUpdate(orderId, status, location, notes, callback) {
  const stmt = db.prepare('INSERT INTO order_tracking (order_id, status, location, notes) VALUES (?, ?, ?, ?)');
  stmt.run(orderId, status, location, notes, callback);
  stmt.finalize();
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
  getSession,
  // Address management
  getUserAddresses,
  getAddressById,
  addAddress,
  updateAddress,
  deleteAddress,
  // Payment methods
  getUserPaymentMethods,
  getPaymentMethodById,
  addPaymentMethod,
  deletePaymentMethod,
  // Collections
  getUserCollections,
  getCollectionById,
  getCollectionItems,
  addCollection,
  addToCollection,
  deleteCollection,
  // Wishlists
  getUserWishlists,
  getWishlistById,
  getWishlistItems,
  addWishlist,
  addToWishlist,
  // Referrals
  getReferralStats,
  getUserReferralCode,
  // Order tracking
  getOrderTracking,
  addTrackingUpdate
};

