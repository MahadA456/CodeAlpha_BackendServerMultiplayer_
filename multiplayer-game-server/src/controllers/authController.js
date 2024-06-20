// src/controllers/authController.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
    db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password TEXT)");
});

const register = (req, res) => {
    const { username, password } = req.body;
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, password], function(err) {
        if (err) {
            return res.status(500).json({ message: 'Failed to register user' });
        }
        res.json({ message: 'User registered', userId: this.lastID });
    });
};

const login = (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, user) => {
        if (err || !user) {
            return res.status(401).send('Authentication failed');
        }
        res.json({ message: 'Logged in successfully', userId: user.id });
    });
};

module.exports = { register, login };
