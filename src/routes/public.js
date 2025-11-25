const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Helper to get the "owner" user (ID 1 or ALLOWED_EMAIL)
const getOwnerUser = async () => {
    if (process.env.ALLOWED_EMAIL) {
        const result = await db.query(`SELECT id, email FROM users WHERE email = $1`, [process.env.ALLOWED_EMAIL]);
        return result.rows[0];
    } else {
        const result = await db.query(`SELECT id, email FROM users WHERE id = 1`);
        return result.rows[0];
    }
};

// Get Public Dashboard Data
router.get('/public/dashboard', async (req, res) => {
    try {
        const user = await getOwnerUser();
        if (!user) return res.status(404).json({ error: 'Owner not found' });

        const now = new Date();
        const startOfDay = new Date(now).setHours(0, 0, 0, 0);
        const endOfDay = new Date(now).setHours(23, 59, 59, 999);

        // Weekly range
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        const startOfWeek = new Date(now);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        // 1. Get Today's Sessions (for Stats, List, and Daily Pie Chart)
        const todaySessionsResult = await db.query(
            `SELECT start, "end", durationSeconds, topicText, isPrivate FROM study_sessions WHERE userId = $1 AND start >= $2 AND start <= $3 ORDER BY start DESC`,
            [user.id, startOfDay, endOfDay]
        );
        
        // Map lowercase DB columns to camelCase and convert BIGINT
        const sessions = todaySessionsResult.rows.map(row => ({
            start: parseInt(row.start),
            end: parseInt(row.end),
            durationSeconds: row.durationseconds,
            topicText: row.topictext,
            isPrivate: row.isprivate
        }));

        // Process Today's Data
        const totalSeconds = sessions.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
        const sessionCount = sessions.length;

        const publicSessions = sessions.map(s => ({
            ...s,
            topicText: (s.isPrivate === 1 || s.isPrivate === '1' || s.isPrivate === true) ? '🔒 Private Session' : (s.topicText || 'Untitled')
        }));

        // Daily Breakdown for Pie Chart
        const dailyBreakdown = {};
        publicSessions.forEach(s => {
            const topic = s.topicText;
            dailyBreakdown[topic] = (dailyBreakdown[topic] || 0) + s.durationSeconds;
        });

        // 2. Get Weekly Data
        const weeklyResult = await db.query(
            `SELECT start, durationSeconds, topicText, isPrivate FROM study_sessions WHERE userId = $1 AND start >= $2 AND start <= $3`,
            [user.id, startOfWeek.getTime(), endOfWeek.getTime()]
        );
        const weeklyRows = weeklyResult.rows;

        // Process Weekly Data
        const weeklyProgress = {};
        const weeklyTopicBreakdown = {};

        // Initialize days
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            const dateStr = d.toLocaleDateString('en-CA');
            weeklyProgress[dateStr] = 0;
        }
        weeklyRows.forEach(row => {
            // row.start is BIGINT (milliseconds)
            const dateStr = new Date(parseInt(row.start)).toLocaleDateString('en-CA');
            if (weeklyProgress[dateStr] !== undefined) {
                weeklyProgress[dateStr] += (row.durationseconds || 0);
            }

            // Topic Breakdown
            const isPrivate = (row.isprivate === 1 || row.isprivate === '1' || row.isprivate === true);
            const topic = isPrivate ? '🔒 Private Session' : (row.topictext || 'Untitled');
            weeklyTopicBreakdown[topic] = (weeklyTopicBreakdown[topic] || 0) + (row.durationseconds || 0);
        });

        // 3. Get Live Status
        const statusResult = await db.query(
            `SELECT currentSessionStart, currentTopic, currentIsPrivate, currentIsPaused, currentPausedDuration FROM users WHERE id = $1`,
            [user.id]
        );
        const status = statusResult.rows[0];

        let liveStatus = null;
        if (status && status.currentsessionstart) {
            liveStatus = {
                start: parseInt(status.currentsessionstart), // Ensure it's a number
                topic: status.currentisprivate ? '🔒 Private Session' : status.currenttopic,
                isPaused: status.currentispaused === 1,
                pausedDuration: status.currentpausedduration ? parseInt(status.currentpausedduration) : null
            };
        }

        res.json({
            stats: { totalSeconds, sessionCount },
            sessions: publicSessions,
            dailyBreakdown,
            weeklyProgress,
            weeklyTopicBreakdown,
            liveStatus
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Public History (Monthly)
router.get('/public/history', async (req, res) => {
    const { year, month } = req.query;

    if (!year || !month) {
        return res.status(400).json({ error: 'Year and month are required' });
    }

    try {
        const user = await getOwnerUser();
        if (!user) return res.status(404).json({ error: 'Owner not found' });

        // Calculate start and end timestamps for the month
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);

        const startTimestamp = startDate.getTime();
        const endTimestamp = endDate.getTime();

        const result = await db.query(
            `SELECT start, "end", durationSeconds, topicText, isPrivate FROM study_sessions WHERE userId = $1 AND start >= $2 AND start <= $3 ORDER BY start ASC`,
            [user.id, startTimestamp, endTimestamp]
        );

        // Format for frontend
        const sessions = result.rows.map(s => ({
            start: parseInt(s.start),
            end: parseInt(s.end),
            durationSeconds: s.durationseconds,
            topicText: (s.isprivate === 1 || s.isprivate === '1' || s.isprivate === true) ? '🔒 Private Session' : (s.topictext || 'Untitled')
        }));

        res.json(sessions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
