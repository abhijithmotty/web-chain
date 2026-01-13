from flask import Flask, request, render_template_string, redirect, session, make_response
import sqlite3
import hashlib
import os
import pickle
import base64

app = Flask(__name__)
app.secret_key = 'super_secret_key_123'  # Intentionally weak secret

# Initialize database
def init_db():
    conn = sqlite3.connect('bank.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (id INTEGER PRIMARY KEY, username TEXT, password TEXT, 
                  role TEXT, balance REAL, email TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS transactions
                 (id INTEGER PRIMARY KEY, from_user TEXT, to_user TEXT, 
                  amount REAL, description TEXT)''')
    
    # Create default users
    c.execute("SELECT * FROM users WHERE username='admin'")
    if not c.fetchone():
        c.execute("INSERT INTO users VALUES (1, 'admin', 'admin123', 'admin', 10000.0, 'admin@bank.com')")
        c.execute("INSERT INTO users VALUES (2, 'john', 'password', 'user', 5000.0, 'john@email.com')")
        c.execute("INSERT INTO users VALUES (3, 'alice', 'alice123', 'user', 3000.0, 'alice@email.com')")
    
    conn.commit()
    conn.close()

init_db()

# Vulnerable login page with SQL Injection
LOGIN_PAGE = '''
<!DOCTYPE html>
<html>
<head>
    <title>SecureBank - Login</title>
    <style>
        body { font-family: Arial; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
               display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .container { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); width: 350px; }
        h1 { color: #667eea; text-align: center; margin-bottom: 30px; }
        input { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box; }
        button { width: 100%; padding: 12px; background: #667eea; color: white; border: none; 
                border-radius: 5px; cursor: pointer; font-size: 16px; margin-top: 10px; }
        button:hover { background: #5568d3; }
        .error { color: red; text-align: center; margin-top: 10px; }
        .hint { font-size: 12px; color: #666; margin-top: 20px; text-align: center; }
        a { color: #667eea; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏦 SecureBank</h1>
        <form method="POST" action="/login">
            <input type="text" name="username" placeholder="Username" required>
            <input type="password" name="password" placeholder="Password" required>
            <button type="submit">Login</button>
        </form>
        {% if error %}
        <div class="error">{{ error }}</div>
        {% endif %}
        <div class="hint">
            <a href="/register">Create new account</a><br>
            Demo: admin/admin123 or john/password
        </div>
    </div>
</body>
</html>
'''

# Vulnerable dashboard with XSS
DASHBOARD_PAGE = '''
<!DOCTYPE html>
<html>
<head>
    <title>SecureBank - Dashboard</title>
    <style>
        body { font-family: Arial; margin: 0; background: #f5f5f5; }
        .header { background: #667eea; color: white; padding: 20px; display: flex; 
                 justify-content: space-between; align-items: center; }
        .container { max-width: 1200px; margin: 20px auto; padding: 20px; }
        .card { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .balance { font-size: 36px; color: #667eea; font-weight: bold; }
        input, textarea { width: 100%; padding: 10px; margin: 5px 0; border: 1px solid #ddd; 
                         border-radius: 5px; box-sizing: border-box; }
        button { padding: 10px 20px; background: #667eea; color: white; border: none; 
                border-radius: 5px; cursor: pointer; margin: 5px; }
        button:hover { background: #5568d3; }
        .logout { background: #dc3545; }
        .logout:hover { background: #c82333; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #667eea; color: white; }
        .role-badge { background: #ffc107; padding: 5px 10px; border-radius: 3px; font-size: 12px; }
        .admin-badge { background: #dc3545; color: white; }
    </style>
</head>
<body>
    <div class="header">
        <h2>🏦 SecureBank Dashboard</h2>
        <div>
            Welcome, {{ username }} 
            {% if role == 'admin' %}
            <span class="role-badge admin-badge">ADMIN</span>
            {% endif %}
            <form method="POST" action="/logout" style="display: inline;">
                <button class="logout" type="submit">Logout</button>
            </form>
        </div>
    </div>
    
    <div class="container">
        <div class="card">
            <h3>Account Balance</h3>
            <div class="balance">${{ balance }}</div>
        </div>

        <div class="card">
            <h3>Transfer Funds</h3>
            <form method="POST" action="/transfer">
                <input type="text" name="to_user" placeholder="Recipient username" required>
                <input type="number" name="amount" placeholder="Amount" step="0.01" required>
                <input type="text" name="description" placeholder="Description">
                <button type="submit">Transfer</button>
            </form>
            {% if transfer_msg %}
            <div style="margin-top: 10px; color: green;">{{ transfer_msg|safe }}</div>
            {% endif %}
        </div>

        {% if role == 'admin' %}
        <div class="card">
            <h3>🔧 Admin Panel</h3>
            <form method="GET" action="/admin/search">
                <input type="text" name="query" placeholder="Search users (SQL query allowed)">
                <button type="submit">Search</button>
            </form>
            
            <form method="POST" action="/admin/create">
                <h4>Create User</h4>
                <input type="text" name="username" placeholder="Username" required>
                <input type="password" name="password" placeholder="Password" required>
                <input type="text" name="email" placeholder="Email">
                <select name="role" style="width: 100%; padding: 10px; margin: 5px 0;">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                </select>
                <input type="number" name="balance" placeholder="Initial Balance" step="0.01" value="1000">
                <button type="submit">Create User</button>
            </form>
        </div>

        {% if users %}
        <div class="card">
            <h3>Search Results</h3>
            <table>
                <tr><th>ID</th><th>Username</th><th>Email</th><th>Role</th><th>Balance</th></tr>
                {% for user in users %}
                <tr>
                    <td>{{ user[0] }}</td>
                    <td>{{ user[1] }}</td>
                    <td>{{ user[5] }}</td>
                    <td>{{ user[3] }}</td>
                    <td>${{ user[4] }}</td>
                </tr>
                {% endfor %}
            </table>
        </div>
        {% endif %}
        {% endif %}

        <div class="card">
            <h3>Recent Transactions</h3>
            <table>
                <tr><th>From</th><th>To</th><th>Amount</th><th>Description</th></tr>
                {% for txn in transactions %}
                <tr>
                    <td>{{ txn[1] }}</td>
                    <td>{{ txn[2] }}</td>
                    <td>${{ txn[3] }}</td>
                    <td>{{ txn[4]|safe }}</td>
                </tr>
                {% endfor %}
            </table>
        </div>
    </div>
</body>
</html>
'''

@app.route('/')
def index():
    if 'username' in session:
        return redirect('/dashboard')
    return render_template_string(LOGIN_PAGE)

# Vulnerable to SQL Injection
@app.route('/login', methods=['POST'])
def login():
    username = request.form['username']
    password = request.form['password']
    
    # VULNERABILITY: SQL Injection
    conn = sqlite3.connect('bank.db')
    c = conn.cursor()
    query = f"SELECT * FROM users WHERE username='{username}' AND password='{password}'"
    c.execute(query)
    user = c.fetchone()
    conn.close()
    
    if user:
        session['username'] = user[1]
        session['role'] = user[3]
        session['balance'] = user[4]
        return redirect('/dashboard')
    
    return render_template_string(LOGIN_PAGE, error="Invalid credentials")

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        email = request.form.get('email', '')
        
        conn = sqlite3.connect('bank.db')
        c = conn.cursor()
        try:
            c.execute("INSERT INTO users (username, password, role, balance, email) VALUES (?, ?, 'user', 1000.0, ?)",
                     (username, password, email))
            conn.commit()
            conn.close()
            return redirect('/')
        except:
            conn.close()
            return "Username already exists", 400
    
    return '''
    <html><body style="font-family: Arial; max-width: 400px; margin: 50px auto;">
    <h2>Register</h2>
    <form method="POST">
        <input type="text" name="username" placeholder="Username" required style="width: 100%; padding: 10px; margin: 5px 0;"><br>
        <input type="password" name="password" placeholder="Password" required style="width: 100%; padding: 10px; margin: 5px 0;"><br>
        <input type="email" name="email" placeholder="Email" style="width: 100%; padding: 10px; margin: 5px 0;"><br>
        <button type="submit" style="width: 100%; padding: 10px; background: #667eea; color: white; border: none; cursor: pointer;">Register</button>
    </form>
    <a href="/">Back to login</a>
    </body></html>
    '''

@app.route('/dashboard')
def dashboard():
    if 'username' not in session:
        return redirect('/')
    
    conn = sqlite3.connect('bank.db')
    c = conn.cursor()
    c.execute("SELECT balance, role FROM users WHERE username=?", (session['username'],))
    user_data = c.fetchone()
    
    c.execute("SELECT * FROM transactions WHERE from_user=? OR to_user=? ORDER BY id DESC LIMIT 10",
             (session['username'], session['username']))
    transactions = c.fetchall()
    conn.close()
    
    return render_template_string(DASHBOARD_PAGE, 
                                 username=session['username'],
                                 role=user_data[1],
                                 balance=user_data[0],
                                 transactions=transactions,
                                 transfer_msg=session.pop('transfer_msg', None),
                                 users=None)

# Vulnerable to XSS and CSRF
@app.route('/transfer', methods=['POST'])
def transfer():
    if 'username' not in session:
        return redirect('/')
    
    to_user = request.form['to_user']
    amount = float(request.form['amount'])
    description = request.form.get('description', '')
    
    conn = sqlite3.connect('bank.db')
    c = conn.cursor()
    
    # Update balances
    c.execute("UPDATE users SET balance = balance - ? WHERE username = ?", (amount, session['username']))
    c.execute("UPDATE users SET balance = balance + ? WHERE username = ?", (amount, to_user))
    
    # VULNERABILITY: XSS - description is not sanitized
    c.execute("INSERT INTO transactions (from_user, to_user, amount, description) VALUES (?, ?, ?, ?)",
             (session['username'], to_user, amount, description))
    
    conn.commit()
    conn.close()
    
    # VULNERABILITY: Reflected XSS
    session['transfer_msg'] = f"Successfully transferred ${amount} to {to_user}!"
    return redirect('/dashboard')

# Admin panel with SQL Injection
@app.route('/admin/search')
def admin_search():
    if 'username' not in session or session.get('role') != 'admin':
        return "Unauthorized", 403
    
    query = request.args.get('query', '')
    
    conn = sqlite3.connect('bank.db')
    c = conn.cursor()
    
    # VULNERABILITY: SQL Injection in search
    if query:
        sql = f"SELECT * FROM users WHERE username LIKE '%{query}%' OR email LIKE '%{query}%'"
        c.execute(sql)
        users = c.fetchall()
    else:
        users = None
    
    c.execute("SELECT * FROM transactions ORDER BY id DESC LIMIT 10")
    transactions = c.fetchall()
    conn.close()
    
    return render_template_string(DASHBOARD_PAGE,
                                 username=session['username'],
                                 role=session['role'],
                                 balance=session.get('balance', 0),
                                 transactions=transactions,
                                 users=users,
                                 transfer_msg=None)

@app.route('/admin/create', methods=['POST'])
def admin_create():
    if 'username' not in session or session.get('role') != 'admin':
        return "Unauthorized", 403
    
    username = request.form['username']
    password = request.form['password']
    email = request.form.get('email', '')
    role = request.form.get('role', 'user')
    balance = float(request.form.get('balance', 1000))
    
    conn = sqlite3.connect('bank.db')
    c = conn.cursor()
    c.execute("INSERT INTO users (username, password, role, balance, email) VALUES (?, ?, ?, ?, ?)",
             (username, password, role, balance, email))
    conn.commit()
    conn.close()
    
    return redirect('/dashboard')

@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return redirect('/')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)