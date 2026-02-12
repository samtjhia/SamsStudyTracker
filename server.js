require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const cronService = require('./src/services/cronService');
const { initDb } = require('./src/db/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
const authRoutes = require('./src/routes/auth');
const sessionRoutes = require('./src/routes/sessions');
const settingsRoutes = require('./src/routes/settings');
const adminRoutes = require('./src/routes/admin');
const publicRoutes = require('./src/routes/public');

app.use('/api', authRoutes);
app.use('/api', sessionRoutes);
app.use('/api', settingsRoutes);
app.use('/api', adminRoutes);
app.use('/api', publicRoutes);

// Start Cron Job
cronService.startCron();

// Serve frontend pages explicitly to avoid catch-all issues
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.get('/history', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'history.html'));
});

// Settings Logic (Moved from routes/settings.js to clarify context)
app.get('/settings', (req, res) => {
    // This is just serving HTML if you had one, but we use a modal.
    res.redirect('/app');
});

// Initialize DB and start server
initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
});
