const cron = require('node-cron');
const db = require('../db/database');
const { sendEmail, generateEmailContent } = require('./emailService');

const startCron = () => {
    // Run every minute
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        // Manually format to HH:MM to ensure consistency with HTML input type="time"
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const currentTime = `${hours}:${minutes}`;
        
        console.log(`[Cron] Checking schedule for time: ${currentTime}`);

        try {
            const result = await db.query(`SELECT * FROM users WHERE dailyEmailTime = $1`, [currentTime]);
            const users = result.rows;

            if (users.length > 0) {
                console.log(`[Cron] Found ${users.length} users scheduled for ${currentTime}`);
            }

            for (const user of users) {
                await processUserReport(user);
            }
        } catch (err) {
            console.error('Error fetching users for cron:', err);
        }
    });
};

const processUserReport = async (user) => {
    // We no longer lock on the User. We lock on the individual emails.
    await generateAndSendReport(user);
};

const generateAndSendReport = async (user) => {
    const startOfDay = new Date().setHours(0, 0, 0, 0);
    const endOfDay = new Date().setHours(23, 59, 59, 999);

    try {
        const sessionsResult = await db.query(
            `SELECT * FROM study_sessions WHERE userId = $1 AND start >= $2 AND start <= $3 ORDER BY start ASC`,
            [user.id, startOfDay, endOfDay]
        );
        // Convert BIGINT strings to Numbers and map lowercase DB columns
        const sessions = sessionsResult.rows.map(s => ({
            ...s,
            start: parseInt(s.start),
            end: parseInt(s.end),
            durationSeconds: s.durationseconds,
            durationMinutes: s.durationminutes,
            topicText: s.topictext
        }));

        if (sessions.length === 0) {
            console.log(`No sessions for user ${user.id} today.`);
            return; 
        }

        const totalSeconds = sessions.reduce((acc, curr) => acc + (curr.durationSeconds || (curr.durationMinutes * 60)), 0);
        
        // Fetch emails that haven't been sent today
        const todayStr = new Date().toLocaleDateString('en-CA');
        
        const emailsResult = await db.query(
            `SELECT id, email FROM accountability_emails WHERE userId = $1`,
            [user.id]
        );
        const emails = emailsResult.rows;

        if (emails.length === 0) return;

        const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        // Handle lowercase column names from Postgres
        const targetMin = user.dailytargetmin || user.dailyTargetMin;
        const displayName = user.username || user.email.split('@')[0];
        
        const emailHtml = generateEmailContent(displayName, dateStr, totalSeconds, targetMin, sessions);
        const subject = `${displayName}'s Study Report — ${dateStr}`;

        for (const emailObj of emails) {
            // Atomic Lock per Email
            const updateResult = await db.query(
                `UPDATE accountability_emails SET lastSentDate = $1 WHERE id = $2 AND (lastSentDate != $3 OR lastSentDate IS NULL)`,
                [todayStr, emailObj.id, todayStr]
            );
            
            if (updateResult.rowCount > 0) {
                // We claimed this email! Send it.
                sendEmail(emailObj.email, subject, emailHtml);
            } else {
                console.log(`Skipping email to ${emailObj.email}: Already sent today.`);
            }
        }
    } catch (err) {
        console.error(`Error generating report for user ${user.id}:`, err);
    }
};

const triggerReportForUser = async (userId) => {
    try {
        const result = await db.query(`SELECT * FROM users WHERE id = $1`, [userId]);
        const user = result.rows[0];
        
        if (!user) {
            console.error(`Error fetching user ${userId} for manual trigger: User not found`);
            return;
        }
        console.log(`Manually triggering report for user ${user.email}`);
        await generateAndSendReport(user);
    } catch (err) {
        console.error(`Error fetching user ${userId} for manual trigger:`, err);
    }
};

module.exports = { startCron, triggerReportForUser };
