const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const supabase = require('../db/supabaseClient');
const authenticateToken = require('../middleware/authMiddleware');

const SECRET_KEY = process.env.JWT_SECRET || 'supersecretkey';

// Internal helper to issue session cookie
const issueSessionCookie = (res, user) => {
    // We sign a JWT with our internal user ID for valid sessions
    // This keeps the rest of the app working with "req.user.id" as an integer
    const token = jwt.sign({ 
        id: user.id, 
        email: user.email, 
        supabaseUid: user.supabase_uid 
    }, SECRET_KEY, { expiresIn: '24h' });
    
    res.cookie('token', token, { httpOnly: true });
};

// Publish Supabase Config for Frontend
router.get('/auth/config', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY
    });
});

// 1. Sync Logic: Frontend sends Supabase Session -> Backend checks if user exists
router.post('/auth/login-sync', async (req, res) => {
    const { access_token } = req.body;
    
    if (!access_token) return res.status(400).json({ error: 'No access token provided' });

    try {
        // Verify with Supabase
        const { data: { user }, error } = await supabase.auth.getUser(access_token);
        
        if (error || !user) return res.status(401).json({ error: 'Invalid Supabase token' });

        // Check if user exists in our DB
        let result = await db.query('SELECT * FROM users WHERE supabase_uid = $1', [user.id]);
        
        // If not found by ID, try to find by EMAIL (Migrate legacy users)
        if (result.rows.length === 0 && user.email) {
            const emailMatch = await db.query('SELECT * FROM users WHERE email = $1', [user.email]);
            if (emailMatch.rows.length > 0) {
                // Determine username: use existing, or fall back to email prefix
                // Update the user to link their Supabase UUID
                // We use RETURNING * to populate 'result' so the login flow continues seamlessly
                result = await db.query(
                    'UPDATE users SET supabase_uid = $1 WHERE email = $2 RETURNING *',
                    [user.id, user.email]
                );
                console.log(`Auto-linked legacy user: ${user.email}`);
            }
        }

        if (result.rows.length > 0) {
            // User exists! create session
            issueSessionCookie(res, result.rows[0]);
            return res.json({ status: 'connected', user: result.rows[0] });
        } else {
            // User authenticated with Google/Email but NOT in our DB
            // Tell frontend to show "Complete Registration" screen
            return res.status(404).json({ 
                status: 'unregistered', 
                email: user.email,
                supabaseUid: user.id 
            });
        }

    } catch (err) {
        console.error('Login sync error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Registration: "The Gatekeeper"
router.post('/auth/register', async (req, res) => {
    const { access_token, username, signupSecret } = req.body;

    // Security Check
    if (!process.env.SIGNUP_SECRET) return res.status(500).json({ error: 'Server misconfiguration.' });
    if (signupSecret !== process.env.SIGNUP_SECRET) {
        return res.status(403).json({ error: 'Invalid Signup Secret Code.' });
    }

    try {
        // Verify token again to be sure
        const { data: { user }, error } = await supabase.auth.getUser(access_token);
        if (error || !user) return res.status(401).json({ error: 'Session expired. Please login again.' });

        // Insert into DB
        // User might already exist by email (if they used the old system). 
        // We should try to update them or insert new.
        
        // Check for existing email match first
        const existing = await db.query('SELECT * FROM users WHERE email = $1', [user.email]);
        
        let localUser;
        if (existing.rows.length > 0) {
            // Link existing legacy user to Supabase
            const update = await db.query(
                `UPDATE users SET supabase_uid = $1, username = COALESCE(username, $2) WHERE email = $3 RETURNING *`, 
                [user.id, username, user.email]
            );
            localUser = update.rows[0];
        } else {
            // Create brand new user
            const insert = await db.query(
                `INSERT INTO users (email, supabase_uid, username) VALUES ($1, $2, $3) RETURNING *`,
                [user.email, user.id, username]
            );
            localUser = insert.rows[0];
        }

        issueSessionCookie(res, localUser);
        res.status(201).json({ status: 'registered', user: localUser });

    } catch (err) {
        if (err.code === '23505') { // Unique violation
             return res.status(400).json({ error: 'User already registered.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Logout
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out' });
});

// Check Auth Status (helper for frontend)
router.get('/me', authenticateToken, async (req, res) => {
    try {
        // Fetch fresh user data from DB to ensure username/settings are up to date
        // (The JWT might be stale or missing fields like username)
        const result = await db.query('SELECT id, email, username, supabase_uid, created_at FROM users WHERE id = $1', [req.user.id]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ authenticated: false });
        }
        
        const user = result.rows[0];
        const isAdmin = process.env.ALLOWED_EMAIL && user.email === process.env.ALLOWED_EMAIL;
        
        res.json({ authenticated: true, user, isAdmin });
    } catch (err) {
        console.error('Error in /me:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
