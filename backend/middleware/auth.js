const supabase = require('../config/supabase');

/**
 * Returns normalized list of authorized admin emails from ADMIN_EMAIL env var.
 * Supports comma-separated values for future scalability.
 */
function getAuthorizedAdminEmails() {
    return (process.env.ADMIN_EMAIL || '')
        .split(',')
        .map(email => email.trim().toLowerCase())
        .filter(Boolean);
}

function isAuthorizedAdminEmail(email) {
    if (!email) return false;
    const authorized = getAuthorizedAdminEmails();
    return authorized.includes(email.trim().toLowerCase());
}

async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization token' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            return res.status(401).json({ error: 'User profile not found' });
        }

        // Enforce admin restriction: only emails in ADMIN_EMAIL may hold admin role
        const effectiveRole = isAuthorizedAdminEmail(user.email) ? 'admin' : 'student';

        req.user = {
            ...user,
            profile: {
                ...profile,
                role: effectiveRole
            }
        };
        next();
    } catch (err) {
        console.error('Auth middleware error:', err);
        return res.status(500).json({ error: 'Authentication failed' });
    }
}

function adminOnly(req, res, next) {
    if (
        !req.user ||
        req.user.profile.role !== 'admin' ||
        !isAuthorizedAdminEmail(req.user.email)
    ) {
        return res.status(403).json({ error: 'Admin access denied. Unauthorized account.' });
    }
    next();
}

function studentOnly(req, res, next) {
    if (!req.user || req.user.profile.role !== 'student') {
        return res.status(403).json({ error: 'Student access required' });
    }
    next();
}

module.exports = {
    authMiddleware,
    adminOnly,
    studentOnly,
    getAuthorizedAdminEmails,
    isAuthorizedAdminEmail
};
