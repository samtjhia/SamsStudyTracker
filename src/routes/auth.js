const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db/database');

const SECRET_KEY = process.env.JWT_SECRET || 'supersecretkey';

// Signup
router.post('/signup', async (req, res) => {
    const { email, password, signupSecret } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    // 1. Check Secret Code (MANDATORY)
    // If the server admin forgot to set a secret, we BLOCK signups for safety.
    if (!process.env.SIGNUP_SECRET) {
        console.error('SECURITY ALERT: SIGNUP_SECRET is missing in .env file. Blocking signup.');
        return res.status(500).json({ error: 'Signup is disabled: Server configuration error.' });
    }

    if (signupSecret !== process.env.SIGNUP_SECRET) {
        return res.status(403).json({ error: 'Invalid signup secret code.' });
    }

    // 2. Check Allowed Email (Optional double-check)
    if (process.env.ALLOWED_EMAIL && email !== process.env.ALLOWED_EMAIL) {
        return res.status(403).json({ error: 'Signup is restricted to authorized users only.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await db.query(`INSERT INTO users (email, passwordHash) VALUES ($1, $2) RETURNING id`, [email, hashedPassword]);
        const userId = result.rows[0].id;
        
        const token = jwt.sign({ id: userId, email }, SECRET_KEY, { expiresIn: '24h' });
        res.cookie('token', token, { httpOnly: true });
        res.status(201).json({ message: 'User created', userId });
    } catch (err) {
        if (err.code === '23505') { // Unique violation
             return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const result = await db.query(`SELECT * FROM users WHERE email = $1`, [email]);
        const user = result.rows[0];
        
        if (!user) return res.status(400).json({ error: 'User not found' });

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

        const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '24h' });
        res.cookie('token', token, { httpOnly: true });
        res.json({ message: 'Logged in' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Logout
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out' });
});

// Check Auth Status (helper for frontend)
router.get('/me', (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ authenticated: false });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ authenticated: false });
        
        const isAdmin = process.env.ALLOWED_EMAIL && user.email === process.env.ALLOWED_EMAIL;
        res.json({ authenticated: true, user, isAdmin });
    });
});

module.exports = router;
