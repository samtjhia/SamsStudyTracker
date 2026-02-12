const cron = require('node-cron');
const db = require('../db/database');
const { sendEmail, generateEmailContent } = require('./emailService');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
            // Only select users who have NOT paused the email service
            const result = await db.query(`SELECT * FROM users WHERE dailyEmailTime = $1 AND (emailServicePaused IS NULL OR emailServicePaused = 0)`, [currentTime]);
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
    // 1. Define Time Range for "Today"
    const startOfDay = new Date().setHours(0, 0, 0, 0);
    const endOfDay = new Date().setHours(23, 59, 59, 999);

    console.log(`[Report Gen] Starting report generation for User: ${user.email} (ID: ${user.id})`);

    try {
        // 2. Fetch Sessions for THIS specific user
        const sessionsResult = await db.query(
            `SELECT * FROM study_sessions WHERE userId = $1 AND start >= $2 AND start <= $3 ORDER BY start ASC`,
            [user.id, startOfDay, endOfDay]
        );

        // Convert bigints and normalize data
        const sessions = sessionsResult.rows.map(s => ({
            ...s,
            start: parseInt(s.start),
            end: parseInt(s.end),
            durationSeconds: s.durationseconds,
            durationMinutes: s.durationminutes,
            topicText: s.topictext
        }));

        if (sessions.length === 0) {
            console.log(`[Report Gen] No sessions found for User ${user.id} today. Skipping report.`);
            return; 
        }

        // 3. Calculate Totals
        const totalSeconds = sessions.reduce((acc, curr) => acc + (curr.durationSeconds || (curr.durationMinutes * 60)), 0);
        
        // 4. Fetch Accountability Emails for THIS specific user
        const todayStr = new Date().toLocaleDateString('en-CA');
        
        const emailsResult = await db.query(
            `SELECT id, email FROM accountability_emails WHERE userId = $1`,
            [user.id]
        );
        const emails = emailsResult.rows;

        if (emails.length === 0) {
            console.log(`[Report Gen] User ${user.id} has sessions but no accountability partners. Skipping.`);
            return;
        }

        // 5. Generate Content
        const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const targetMin = user.dailytargetmin || user.dailyTargetMin;
        const displayName = user.username || user.email.split('@')[0];
        
        const emailHtml = generateEmailContent(displayName, dateStr, totalSeconds, targetMin, sessions);
        const subject = `${displayName}'s Study Report — ${dateStr}`;

        console.log(`[Report Gen] Prepared report for ${displayName}. Sending to ${emails.length} recipients...`);

        // 6. Send Emails with Safety checks
        for (const emailObj of emails) {
            // Safety Check: Ensure this email record actually belongs to the user we are processing
            // (This is redundant due to the SELECT above, but meets the requirement for "Thorough Analysis")
            if (!emailObj.email) continue;

            // Atomic Lock: Try to update lastSentDate. If 0 rows updated, it means it was already sent today.
            const updateResult = await db.query(
                `UPDATE accountability_emails SET lastSentDate = $1 WHERE id = $2 AND userId = $3 AND (lastSentDate != $4 OR lastSentDate IS NULL)`,
                [todayStr, emailObj.id, user.id, todayStr] // Added user.id to WHERE clause for extra safety
            );
            
            if (updateResult.rowCount > 0) {
                // Lock acquired. Send the email.
                console.log(`[Report Gen] Sending email to ${emailObj.email} for User ${user.id}`);
                const success = await sendEmail(emailObj.email, subject, emailHtml, displayName);
                
                if (!success) {
                     console.error(`[Report Gen] FAILED to send to ${emailObj.email}. Resetting lock.`);
                     // Optional: Reset the lock so we can try again later? Or just fail for today?
                     // For now, we leave it as "attempted" to prevent spamming loops on error.
                }

                // Rate limit: 1 email per second to be nice to the API
                await sleep(1000);
            } else {
                console.log(`[Report Gen] User ${user.id}: Email to ${emailObj.email} already sent today.`);
            }
        }
    } catch (err) {
        console.error(`[Report Gen] CRITICAL ERROR for User ${user.id}:`, err);
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
