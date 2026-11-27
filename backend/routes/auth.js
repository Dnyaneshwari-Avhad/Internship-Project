const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware, isAuthorizedAdminEmail } = require('../middleware/auth');

// ---- Validation Helpers ----
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
    const digits = (phone || '').replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
}

function isStudentProfileComplete(student) {
    if (!student) return false;
    if (student.profile_completed === true) return true;
    return Boolean(
        (student.full_name || (student.first_name && student.last_name)) &&
        student.phone &&
        student.college_name &&
        student.course_id &&
        student.center_id &&
        student.date_of_birth &&
        student.branch &&
        student.academic_year
    );
}

async function ensureProfileForUser(user) {
    const isAdmin = isAuthorizedAdminEmail(user.email);
    const desiredRole = isAdmin ? 'admin' : 'student';
    const cleanEmail = (user.email || '').trim().toLowerCase();

    const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

    if (existingProfile) {
        if (existingProfile.role !== desiredRole) {
            const { data: updated } = await supabase
                .from('profiles')
                .update({ role: desiredRole, updated_at: new Date().toISOString() })
                .eq('id', user.id)
                .select()
                .single();
            return updated || { ...existingProfile, role: desiredRole };
        }
        return existingProfile;
    }

    const fullName =
        (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) ||
        (cleanEmail ? cleanEmail.split('@')[0] : 'User');

    const { data: inserted, error } = await supabase
        .from('profiles')
        .upsert({
            id: user.id,
            full_name: fullName,
            email: cleanEmail,
            role: desiredRole,
            avatar_url: user.user_metadata ? user.user_metadata.avatar_url || null : null,
            updated_at: new Date().toISOString()
        }, { onConflict: 'id' })
        .select()
        .single();

    if (error) {
        // Fallback: if email already exists in profiles (e.g., recreated auth user), update by email
        if (error.message && error.message.toLowerCase().includes('profiles_email_key')) {
            const { data: updatedByEmail, error: emailErr } = await supabase
                .from('profiles')
                .update({
                    id: user.id,
                    full_name: fullName,
                    role: desiredRole,
                    updated_at: new Date().toISOString()
                })
                .eq('email', cleanEmail)
                .select()
                .single();
            if (!emailErr && updatedByEmail) return updatedByEmail;
        }
        throw new Error(error.message);
    }
    return inserted;
}

async function findOrLinkStudent(user) {
    // 1. Try by user_id
    let { data: student } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

    if (student) return student;

    // 2. Try matching pre-created student record by email and link user_id
    const { data: byEmail } = await supabase
        .from('students')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();

    if (byEmail && !byEmail.user_id) {
        const { data: linked } = await supabase
            .from('students')
            .update({ user_id: user.id, updated_at: new Date().toISOString() })
            .eq('id', byEmail.id)
            .select()
            .single();
        return linked || byEmail;
    }

    return null;
}

// ---- Public Auth Config (ONLY URL + public Anon Key, never Service Role Key) ----
router.get('/config', (req, res) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
        return res.status(503).json({ error: 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in Vercel environment variables.' });
    }
    res.json({
        supabaseUrl: url,
        supabaseAnonKey: key
    });
});

// ---- Student Sign Up ----
router.post('/signup', async (req, res) => {
    const {
        first_name,
        last_name,
        email,
        password,
        confirm_password,
        phone,
        date_of_birth,
        college_name,
        branch,
        academic_year,
        center_id,
        course_id,
        profile_image
    } = req.body;

    // Validate required fields
    if (
        !first_name || !last_name || !email || !password || !confirm_password ||
        !phone || !date_of_birth || !college_name || !branch || !academic_year ||
        !center_id || !course_id
    ) {
        return res.status(400).json({ error: 'All required fields must be filled out.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (isAuthorizedAdminEmail(cleanEmail)) {
        return res.status(403).json({ error: 'This email is reserved and cannot be used for student signup.' });
    }

    if (!isValidPhone(phone)) {
        return res.status(400).json({ error: 'Please enter a valid 10-digit phone number.' });
    }

    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        return res.status(400).json({ error: 'Password must be at least 8 characters and include both letters and numbers.' });
    }

    if (password !== confirm_password) {
        return res.status(400).json({ error: 'Passwords do not match.' });
    }

    try {
        // Prevent duplicate student registration
        const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', cleanEmail)
            .maybeSingle();

        if (existingProfile) {
            return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
        }

        const { data: existingStudent } = await supabase
            .from('students')
            .select('id, user_id')
            .eq('email', cleanEmail)
            .maybeSingle();

        if (existingStudent && existingStudent.user_id) {
            return res.status(409).json({ error: 'A student with this email is already registered.' });
        }

        const fullName = `${first_name.trim()} ${last_name.trim()}`;

        // Create Supabase Auth user (role strictly 'student')
        const { data: created, error: createError } = await supabase.auth.admin.createUser({
            email: cleanEmail,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: fullName,
                first_name: first_name.trim(),
                last_name: last_name.trim(),
                avatar_url: profile_image || null
            }
        });

        if (createError || !created.user) {
            const msg = createError ? createError.message : 'Failed to create user account.';
            return res.status(400).json({ error: msg });
        }

        const userId = created.user.id;

        // Ensure profile exists with role='student'
        await supabase.from('profiles').upsert({
            id: userId,
            full_name: fullName,
            email: cleanEmail,
            phone: phone.trim(),
            role: 'student',
            avatar_url: profile_image || null,
            profile_completed: true,
            updated_at: new Date().toISOString()
        });

        // Create or link student record
        const studentPayload = {
            user_id: userId,
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            full_name: fullName,
            email: cleanEmail,
            phone: phone.trim(),
            date_of_birth,
            college_name: college_name.trim(),
            branch: branch.trim(),
            academic_year: academic_year.trim(),
            center_id,
            course_id,
            profile_image: profile_image || null,
            profile_completed: true,
            status: 'active',
            joining_date: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString()
        };

        let studentRecord;
        if (existingStudent) {
            const { data: updatedStudent, error: updErr } = await supabase
                .from('students')
                .update(studentPayload)
                .eq('id', existingStudent.id)
                .select()
                .single();
            if (updErr) throw new Error(updErr.message);
            studentRecord = updatedStudent;
        } else {
            const { data: insertedStudent, error: insErr } = await supabase
                .from('students')
                .insert(studentPayload)
                .select()
                .single();
            if (insErr) throw new Error(insErr.message);
            studentRecord = insertedStudent;

            // Initialize aptitude progress row
            await supabase.from('aptitude_progress').insert({
                student_id: studentRecord.id,
                total_lectures: 30,
                completed_lectures: 0
            });
        }

        // Sign in immediately to obtain a valid session token
        const authClient = supabase.createAuthClient();
        const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
            email: cleanEmail,
            password
        });

        if (signInError || !signInData.session) {
            return res.status(201).json({
                message: 'Registration successful! Please sign in.',
                requiresLogin: true
            });
        }

        const profile = await ensureProfileForUser(signInData.user);

        res.status(201).json({
            user: signInData.user,
            session: signInData.session,
            profile,
            student: studentRecord,
            needsProfileCompletion: false
        });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ error: err.message || 'Registration failed. Please try again.' });
    }
});

// ---- Email & Password Sign In ----
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const authClient = supabase.createAuthClient();
        const { data, error } = await authClient.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password
        });
        if (error) return res.status(401).json({ error: error.message });

        const profile = await ensureProfileForUser(data.user);

        let student = null;
        let needsProfileCompletion = false;

        if (profile.role === 'student') {
            student = await findOrLinkStudent(data.user);
            needsProfileCompletion = !isStudentProfileComplete(student);
        }

        res.json({
            user: data.user,
            session: data.session,
            profile,
            student,
            needsProfileCompletion
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

// ---- Exchange / Verify Google OAuth Session ----
router.post('/oauth-session', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing authorization token' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            return res.status(401).json({ error: 'Invalid or expired OAuth session' });
        }

        const profile = await ensureProfileForUser(user);

        if (profile.role === 'admin') {
            return res.json({
                user,
                profile,
                student: null,
                needsProfileCompletion: false
            });
        }

        const student = await findOrLinkStudent(user);
        const needsProfileCompletion = !isStudentProfileComplete(student);

        res.json({
            user,
            profile,
            student,
            needsProfileCompletion
        });
    } catch (err) {
        console.error('OAuth session error:', err);
        res.status(500).json({ error: err.message || 'Failed to process Google sign-in' });
    }
});

// ---- Student Profile Completion (for Google OAuth / incomplete profiles) ----
router.post('/complete-profile', authMiddleware, async (req, res) => {
    if (req.user.profile.role === 'admin') {
        return res.status(403).json({ error: 'Admin accounts do not use student profile completion.' });
    }

    const {
        first_name,
        last_name,
        phone,
        date_of_birth,
        college_name,
        branch,
        academic_year,
        center_id,
        course_id,
        batch_id
    } = req.body;

    if (
        !first_name || !last_name || !phone || !date_of_birth ||
        !college_name || !branch || !academic_year || !center_id || !course_id
    ) {
        return res.status(400).json({ error: 'Please fill in all required profile fields.' });
    }

    if (!isValidPhone(phone)) {
        return res.status(400).json({ error: 'Please enter a valid 10-digit phone number.' });
    }

    try {
        const fullName = `${first_name.trim()} ${last_name.trim()}`;
        const userEmail = req.user.email.toLowerCase();

        // Update profiles
        const { data: updatedProfile, error: profErr } = await supabase
            .from('profiles')
            .update({
                full_name: fullName,
                phone: phone.trim(),
                role: 'student',
                profile_completed: true,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.user.id)
            .select()
            .single();

        if (profErr) throw new Error(profErr.message);

        // Check if student row exists for this user or email
        let existing = await findOrLinkStudent(req.user);

        const studentPayload = {
            user_id: req.user.id,
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            full_name: fullName,
            email: userEmail,
            phone: phone.trim(),
            date_of_birth,
            college_name: college_name.trim(),
            branch: branch.trim(),
            academic_year: academic_year.trim(),
            center_id,
            course_id,
            batch_id: batch_id || null,
            profile_completed: true,
            status: 'active',
            updated_at: new Date().toISOString()
        };

        let studentRecord;
        if (existing) {
            const { data: upd, error: updErr } = await supabase
                .from('students')
                .update(studentPayload)
                .eq('id', existing.id)
                .select()
                .single();
            if (updErr) throw new Error(updErr.message);
            studentRecord = upd;
        } else {
            studentPayload.joining_date = new Date().toISOString().split('T')[0];
            const { data: ins, error: insErr } = await supabase
                .from('students')
                .insert(studentPayload)
                .select()
                .single();
            if (insErr) throw new Error(insErr.message);
            studentRecord = ins;

            await supabase.from('aptitude_progress').insert({
                student_id: studentRecord.id,
                total_lectures: 30,
                completed_lectures: 0
            });
        }

        res.json({
            profile: updatedProfile,
            student: studentRecord,
            needsProfileCompletion: false
        });
    } catch (err) {
        console.error('Complete profile error:', err);
        res.status(500).json({ error: err.message || 'Failed to save student profile.' });
    }
});

// ---- Forgot Password ----
router.post('/forgot-password', async (req, res) => {
    const { email, redirectTo } = req.body;
    if (!email || !isValidEmail(email.trim())) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    try {
        const authClient = supabase.createAuthClient();
        const { error } = await authClient.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
            redirectTo: redirectTo || `${req.protocol}://${req.get('host')}/login`
        });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ message: 'Password reset instructions have been sent to your email.' });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: 'Failed to send password reset email.' });
    }
});

// ---- Get current user profile ----
router.get('/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) return res.status(401).json({ error: 'Invalid token' });

        const profile = await ensureProfileForUser(user);

        let student = null;
        let needsProfileCompletion = false;
        if (profile.role === 'student') {
            student = await findOrLinkStudent(user);
            needsProfileCompletion = !isStudentProfileComplete(student);
        }

        res.json({ user, profile, student, needsProfileCompletion });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// ---- Logout ----
router.post('/logout', async (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

module.exports = router;
