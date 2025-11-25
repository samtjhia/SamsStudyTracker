const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticateToken = require('../middleware/authMiddleware');
const { triggerReportForUser } = require('../services/cronService');

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
    if (!process.env.ALLOWED_EMAIL || req.user.email !== process.env.ALLOWED_EMAIL) {
        return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    next();
};

// List all users with their accountability emails
router.get('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const usersResult = await db.query(`SELECT id, email, dailyTargetMin, dailyEmailTime FROM users`);
        // Map lowercase DB columns to camelCase
        const users = usersResult.rows.map(u => ({
            id: u.id,
            email: u.email,
            dailyTargetMin: u.dailytargetmin,
            dailyEmailTime: u.dailyemailtime
        }));
        
        // Fetch emails for all users
        for (const user of users) {
            const emailsResult = await db.query(
                `SELECT id, email, lastSentDate FROM accountability_emails WHERE userId = $1`,
                [user.id]
            );
            user.accountabilityEmails = emailsResult.rows.map(e => ({
                id: e.id,
                email: e.email,
                lastSentDate: e.lastsentdate
            }));
        }

        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reset email status for a specific accountability email
router.post('/admin/emails/:id/reset', authenticateToken, requireAdmin, async (req, res) => {
    const emailId = req.params.id;
    try {
        await db.query(`UPDATE accountability_emails SET lastSentDate = NULL WHERE id = $1`, [emailId]);
        res.json({ message: 'Email status reset.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Trigger report for a user immediately
router.post('/admin/users/:id/trigger-report', authenticateToken, requireAdmin, (req, res) => {
    const userId = req.params.id;
    triggerReportForUser(userId);
    res.json({ message: 'Report generation triggered. Check logs/email.' });
});

// Delete a user
router.delete('/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    const userId = req.params.id;

    // Prevent deleting yourself (optional, but good safety)
    if (parseInt(userId) === req.user.id) {
        return res.status(400).json({ error: 'You cannot delete your own admin account.' });
    }

    try {
        await db.query(`DELETE FROM study_sessions WHERE userId = $1`, [userId]);
        await db.query(`DELETE FROM accountability_emails WHERE userId = $1`, [userId]);
        await db.query(`DELETE FROM users WHERE id = $1`, [userId]);
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
