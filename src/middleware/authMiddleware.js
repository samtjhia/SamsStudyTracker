const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET || 'supersecretkey';

const authenticateToken = (req, res, next) => {
    // 1. Check for token in cookies (preferred for our app structure) or Authorization header
    let token = req.cookies.token || req.headers['authorization']?.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'No token provided' });

    // 2. Verify our Internal JWT (Not Supabase Token)
    // We signed this token in /api/auth/login-sync after verifying Supabase identity
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            console.error('JWT Verification Failed:', err.message);
            return res.status(403).json({ error: 'Invalid or expired session' });
        }
        
        // 3. Attach user info (includes id, email, supabaseUid)
        req.user = user;
        next();
    });
};

module.exports = authenticateToken;
