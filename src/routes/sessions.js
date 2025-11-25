const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticateToken = require('../middleware/authMiddleware');

// Create Session
router.post('/session', authenticateToken, async (req, res) => {
    const { start, end, durationSeconds, topicText, isPrivate } = req.body;
    const userId = req.user.id;

    // Also store durationMinutes for backward compatibility if needed, or just calculate it
    const durationMinutes = Math.round(durationSeconds / 60);

    try {
        const result = await db.query(`INSERT INTO study_sessions (userId, start, "end", durationSeconds, durationMinutes, topicText, isPrivate) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [userId, start, end, durationSeconds, durationMinutes, topicText, isPrivate ? 1 : 0]);
        res.status(201).json({ id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Live Status (Start)
router.post('/session/live/start', authenticateToken, async (req, res) => {
    const { start, topicText, isPrivate } = req.body;
    const userId = req.user.id;

    try {
        await db.query(`UPDATE users SET currentSessionStart = $1, currentTopic = $2, currentIsPrivate = $3, currentIsPaused = 0, currentPausedDuration = NULL WHERE id = $4`,
            [start, topicText, isPrivate ? 1 : 0, userId]);
        res.json({ message: 'Live status updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Live Status (Pause)
router.post('/session/live/pause', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { duration } = req.body;

    try {
        await db.query(`UPDATE users SET currentIsPaused = 1, currentPausedDuration = $1 WHERE id = $2`, [duration, userId]);
        res.json({ message: 'Live status paused' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Live Status (Stop)
router.post('/session/live/stop', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        await db.query(`UPDATE users SET currentSessionStart = NULL, currentTopic = NULL, currentIsPrivate = NULL, currentIsPaused = 0, currentPausedDuration = NULL WHERE id = $1`,
            [userId]);
        res.json({ message: 'Live status cleared' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Session (Rename or Change Privacy)
router.put('/session/:id', authenticateToken, async (req, res) => {
    const { topicText, isPrivate } = req.body;
    const sessionId = req.params.id;
    const userId = req.user.id;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (topicText !== undefined) {
        updates.push(`topicText = $${paramIndex++}`);
        values.push(topicText);
    }

    if (isPrivate !== undefined) {
        updates.push(`isPrivate = $${paramIndex++}`);
        values.push(isPrivate ? 1 : 0);
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(sessionId);
    values.push(userId);

    const sql = `UPDATE study_sessions SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND userId = $${paramIndex++}`;

    try {
        const result = await db.query(sql, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Session not found' });
        res.json({ message: 'Session updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Session
router.delete('/session/:id', authenticateToken, async (req, res) => {
    const sessionId = req.params.id;
    const userId = req.user.id;

    try {
        const result = await db.query(`DELETE FROM study_sessions WHERE id = $1 AND userId = $2`,
            [sessionId, userId]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Session not found' });
        res.json({ message: 'Session deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Today's Sessions
router.get('/sessions/today', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const startOfDay = new Date().setHours(0, 0, 0, 0);
    const endOfDay = new Date().setHours(23, 59, 59, 999);

    try {
        const result = await db.query(`SELECT * FROM study_sessions WHERE userId = $1 AND start >= $2 AND start <= $3 ORDER BY start DESC`,
            [userId, startOfDay, endOfDay]);
        
        // Convert BIGINT strings to Numbers and map lowercase DB columns to camelCase
        const sessions = result.rows.map(row => ({
            id: row.id,
            userId: row.userid,
            start: parseInt(row.start),
            end: parseInt(row.end),
            durationSeconds: row.durationseconds,
            durationMinutes: row.durationminutes,
            topicText: row.topictext,
            isPrivate: row.isprivate
        }));

        res.json(sessions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Today's Stats
router.get('/stats/today', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const startOfDay = new Date().setHours(0, 0, 0, 0);
    const endOfDay = new Date().setHours(23, 59, 59, 999);

    try {
        const result = await db.query(`SELECT durationSeconds FROM study_sessions WHERE userId = $1 AND start >= $2 AND start <= $3`,
            [userId, startOfDay, endOfDay]);
        const rows = result.rows;
        
        const totalSeconds = rows.reduce((acc, curr) => acc + (curr.durationseconds || 0), 0);
        const sessionCount = rows.length;
        const longestSession = rows.reduce((max, curr) => Math.max(max, (curr.durationseconds || 0)), 0);

        res.json({ totalSeconds, sessionCount, longestSession });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Weekly Stats (Mon-Sun)
router.get('/stats/weekly', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const now = new Date();
    const day = now.getDay(); // 0 (Sun) - 6 (Sat)
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    try {
        const result = await db.query(`SELECT start, durationSeconds, topicText FROM study_sessions WHERE userId = $1 AND start >= $2 AND start <= $3 ORDER BY start ASC`,
            [userId, startOfWeek.getTime(), endOfWeek.getTime()]);
        const rows = result.rows;
        
        // Group by day
        const dailyTotals = {};
        const topicBreakdown = {};

        // Initialize all days to 0
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            // Use local date string for consistency
            const dateStr = d.toLocaleDateString('en-CA'); 
            dailyTotals[dateStr] = 0;
        }

        rows.forEach(row => {
            // Ensure we use the same locale/timezone logic
            // Postgres returns BIGINT as string sometimes, so we parse it
            const start = Number(row.start);
            const dateStr = new Date(start).toLocaleDateString('en-CA');
            if (dailyTotals[dateStr] !== undefined) {
                dailyTotals[dateStr] += (row.durationseconds || 0);
            }

            // Topic Breakdown
            const topic = row.topictext || 'Untitled';
            topicBreakdown[topic] = (topicBreakdown[topic] || 0) + (row.durationseconds || 0);
        });

        res.json({ dailyTotals, topicBreakdown });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get History (Monthly)
router.get('/sessions/history', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { year, month } = req.query; // month is 0-indexed (0-11) or 1-indexed? Let's assume 1-indexed for API, but JS Date is 0-indexed. Let's use 1-12.

    if (!year || !month) {
        return res.status(400).json({ error: 'Year and month are required' });
    }

    try {
        // Calculate start and end timestamps for the month
        // Note: month is 1-12
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of the month

        const startTimestamp = startDate.getTime();
        const endTimestamp = endDate.getTime();

        const result = await db.query(
            `SELECT * FROM study_sessions WHERE userId = $1 AND start >= $2 AND start <= $3 ORDER BY start ASC`,
            [userId, startTimestamp, endTimestamp]
        );

        // Format for frontend
        const sessions = result.rows.map(s => ({
            ...s,
            start: parseInt(s.start),
            end: parseInt(s.end),
            durationSeconds: s.durationseconds,
            topicText: s.topictext
        }));

        res.json(sessions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Current Live Session
router.get('/session/live', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await db.query(
            `SELECT currentSessionStart, currentTopic, currentIsPrivate, currentIsPaused, currentPausedDuration FROM users WHERE id = $1`,
            [userId]
        );
        const user = result.rows[0];
        
        if (user && user.currentsessionstart) {
            res.json({
                start: parseInt(user.currentsessionstart),
                topic: user.currenttopic,
                isPrivate: user.currentisprivate === 1,
                isPaused: user.currentispaused === 1,
                pausedDuration: user.currentpausedduration ? parseInt(user.currentpausedduration) : null
            });
        } else {
            res.json(null);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
