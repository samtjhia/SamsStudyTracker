const db = require('../db/database');
const supabase = require('../db/supabaseClient');

const authenticateToken = async (req, res, next) => {
    // 1. Check for token in cookies (preferred for our app structure) or Authorization header
    let token = req.cookies.token || req.headers['authorization']?.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
        // 2. Verify token with Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        // 3. Find corresponding local user
        const result = await db.query('SELECT * FROM users WHERE supabase_uid = $1', [user.id]);
        
        if (result.rows.length === 0) {
            // Valid Supabase user, but not in our database (Registration incomplete)
            return res.status(403).json({ error: 'User not registered in local database', requireRegistration: true, supabaseUser: user });
        }

        // 4. Attach local user ID to request (preserving existing logic)
        req.user = {
            id: result.rows[0].id,
            email: result.rows[0].email,
            supabaseUid: user.id
        };
        
        next();
    } catch (err) {
        console.error('Auth Middleware Error:', err);
        return res.status(500).json({ error: 'Internal Server Error during authentication' });
    }
};

module.exports = authenticateToken;
