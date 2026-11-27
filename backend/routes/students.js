const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Get all students (with optional filters)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { course_id, batch_id, center_id, status, search } = req.query;
        let query = supabase
            .from('students')
            .select(`
                *,
                courses(name),
                batches(name),
                training_centers(name)
            `)
            .order('created_at', { ascending: false });

        if (course_id) query = query.eq('course_id', course_id);
        if (batch_id) query = query.eq('batch_id', batch_id);
        if (center_id) query = query.eq('center_id', center_id);
        if (status) query = query.eq('status', status);
        if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);

        // If student role, only return their own record
        if (req.user.profile.role === 'student') {
            query = query.eq('user_id', req.user.id);
        }

        const { data, error } = await query;
        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    } catch (err) {
        console.error('Get students error:', err);
        res.status(500).json({ error: 'Failed to fetch students' });
    }
});

// Get single student
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('students')
            .select(`
                *,
                courses(name, description, duration, technologies),
                batches(name, start_date, end_date, timing),
                training_centers(name, address)
            `)
            .eq('id', req.params.id)
            .single();

        if (error) return res.status(404).json({ error: 'Student not found' });

        // Students can only view their own profile
        if (req.user.profile.role === 'student' && data.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch student' });
    }
});

// Create student (admin only)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { full_name, email, phone, college_name, course_id, batch_id, center_id, joining_date } = req.body;

        if (!full_name || !email) {
            return res.status(400).json({ error: 'Full name and email are required' });
        }

        const { data, error } = await supabase
            .from('students')
            .insert({
                full_name,
                email,
                phone,
                college_name,
                course_id: course_id || null,
                batch_id: batch_id || null,
                center_id: center_id || null,
                joining_date: joining_date || new Date().toISOString().split('T')[0]
            })
            .select()
            .single();

        if (error) return res.status(400).json({ error: error.message });

        // Create aptitude progress record
        await supabase.from('aptitude_progress').insert({
            student_id: data.id,
            total_lectures: 30,
            completed_lectures: 0
        });

        res.status(201).json(data);
    } catch (err) {
        console.error('Create student error:', err);
        res.status(500).json({ error: 'Failed to create student' });
    }
});

// Update student (admin only)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { full_name, email, phone, college_name, course_id, batch_id, center_id, status, joining_date } = req.body;

        const { data, error } = await supabase
            .from('students')
            .update({
                full_name,
                email,
                phone,
                college_name,
                course_id: course_id || null,
                batch_id: batch_id || null,
                center_id: center_id || null,
                status,
                joining_date,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update student' });
    }
});

// Delete student (admin only)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { error } = await supabase
            .from('students')
            .delete()
            .eq('id', req.params.id);

        if (error) return res.status(400).json({ error: error.message });
        res.json({ message: 'Student deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete student' });
    }
});

module.exports = router;
