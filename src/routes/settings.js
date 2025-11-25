const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticateToken = require('../middleware/authMiddleware');

// Get Settings
router.get('/settings', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    
    try {
        // Select dailyEmailTime
        const userResult = await db.query(
            `SELECT dailyTargetMin, dailyEmailTime, username, emailServicePaused FROM users WHERE id = $1`,
            [userId]
        );
        const row = userResult.rows[0];
        const user = {
            dailyTargetMin: row.dailytargetmin,
            dailyEmailTime: row.dailyemailtime,
            username: row.username,
            emailServicePaused: row.emailservicepaused === 1
        };

        const emailsResult = await db.query(
            `SELECT email FROM accountability_emails WHERE userId = $1`,
            [userId]
        );
        
        res.json({ ...user, accountabilityEmails: emailsResult.rows.map(e => e.email) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Settings
router.post('/settings', authenticateToken, async (req, res) => {
    const { dailyTargetMin, dailyEmailTime, username, emailServicePaused } = req.body;
    const userId = req.user.id;

    try {
        await db.query(
            `UPDATE users SET dailyTargetMin = $1, dailyEmailTime = $2, username = $3, emailServicePaused = $4 WHERE id = $5`,
            [dailyTargetMin, dailyEmailTime, username, emailServicePaused ? 1 : 0, userId]
        );
        res.json({ message: 'Settings updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add Email
router.post('/emails/add', authenticateToken, async (req, res) => {
    const { email } = req.body;
    const userId = req.user.id;

    try {
        // Check for duplicate
        const checkResult = await db.query(
            `SELECT id FROM accountability_emails WHERE userId = $1 AND email = $2`,
            [userId, email]
        );
        
        if (checkResult.rows.length > 0) {
            return res.status(400).json({ error: 'Email already added' });
        }

        const insertResult = await db.query(
            `INSERT INTO accountability_emails (userId, email) VALUES ($1, $2) RETURNING id`,
            [userId, email]
        );
        res.status(201).json({ id: insertResult.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Email
router.post('/emails/delete', authenticateToken, async (req, res) => {
    const { email } = req.body;
    const userId = req.user.id;

    try {
        await db.query(
            `DELETE FROM accountability_emails WHERE userId = $1 AND email = $2`,
            [userId, email]
        );
        res.json({ message: 'Email deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
