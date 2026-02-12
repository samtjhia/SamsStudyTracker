const { Pool } = require('pg');

// Determine if we need SSL (Production OR Remote Database like Supabase)
const isProduction = process.env.NODE_ENV === 'production';
const connectionString = process.env.DATABASE_URL;
// Assume remote if not localhost/127.0.0.1
const isRemoteDB = connectionString && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1');

const pool = new Pool({
    connectionString: connectionString,
    ssl: (isProduction || isRemoteDB) ? { rejectUnauthorized: false } : false,
    // Add keep-alive settings to prevent Supabase connection drops
    keepAlive: true,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
});

const initDb = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Users table
        await client.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE,
            passwordHash TEXT,
            dailyTargetMin INTEGER DEFAULT 120,
            dailyEmailTime TEXT DEFAULT '20:00',
            lastEmailDate TEXT,
            currentSessionStart BIGINT,
            currentTopic TEXT,
            currentIsPrivate INTEGER DEFAULT 0,
            currentIsPaused INTEGER DEFAULT 0,
            currentPausedDuration BIGINT,
            username TEXT
        )`);

        // Add columns if they don't exist (migration)
        try {
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS currentIsPaused INTEGER DEFAULT 0`);
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS currentPausedDuration BIGINT`);
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT`);
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS emailServicePaused INTEGER DEFAULT 0`);
            // Add Supabase UID column for linking Supabase Auth users to our local users table
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_uid UUID UNIQUE`);
        } catch (e) {
            // Ignore error if column exists or other minor issue
            console.log('Migration note: column check');
        }

        // StudySessions table
        await client.query(`CREATE TABLE IF NOT EXISTS study_sessions (
            id SERIAL PRIMARY KEY,
            userId INTEGER REFERENCES users(id) ON DELETE CASCADE,
            start BIGINT,
            "end" BIGINT,
            durationMinutes INTEGER,
            durationSeconds INTEGER,
            topicText TEXT,
            isPrivate INTEGER DEFAULT 0
        )`);

        // AccountabilityEmails table
        await client.query(`CREATE TABLE IF NOT EXISTS accountability_emails (
            id SERIAL PRIMARY KEY,
            userId INTEGER REFERENCES users(id) ON DELETE CASCADE,
            email TEXT,
            lastSentDate TEXT
        )`);

        await client.query('COMMIT');
        console.log('Connected to PostgreSQL database and schema initialized.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error initializing database:', e);
    } finally {
        client.release();
    }
};

// Initialize DB on start
// initDb(); // Removed auto-call

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
    initDb // Export it
};
