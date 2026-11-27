const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Get all aptitude progress (with optional filters)
router.get('/', authMiddleware, async (req, res) => {
    try {
        let query = supabase
            .from('aptitude_progress')
            .select(`
                *,
                students(full_name, email, batch_id, center_id, batches(name), training_centers(name))
            `)
            .order('last_updated', { ascending: false });

        // Students see only their own
        if (req.user.profile.role === 'student') {
            const { data: studentRecord } = await supabase
                .from('students')
                .select('id')
                .eq('user_id', req.user.id)
                .single();
            if (studentRecord) {
                query = query.eq('student_id', studentRecord.id);
            }
        }

        const { data, error } = await query;
        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch aptitude progress' });
    }
});

// Get single student aptitude progress
router.get('/:studentId', authMiddleware, async (req, res) => {
    try {
        if (req.user.profile.role === 'student') {
            const { data: ownStudent } = await supabase
                .from('students')
                .select('id')
                .eq('user_id', req.user.id)
                .maybeSingle();
            if (!ownStudent || ownStudent.id !== req.params.studentId) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        const { data, error } = await supabase
            .from('aptitude_progress')
            .select(`
                *,
                students(full_name, email)
            `)
            .eq('student_id', req.params.studentId)
            .single();

        if (error) return res.status(404).json({ error: 'Progress not found' });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch aptitude progress' });
    }
});

// Update aptitude progress (admin only)
router.put('/:studentId', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { total_lectures, completed_lectures, notes } = req.body;

        const { data, error } = await supabase
            .from('aptitude_progress')
            .update({
                total_lectures,
                completed_lectures,
                notes,
                last_updated: new Date().toISOString()
            })
            .eq('student_id', req.params.studentId)
            .select()
            .single();

        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update aptitude progress' });
    }
});

// Bulk update aptitude progress (admin only)
router.post('/bulk-update', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { updates } = req.body; // Array of { student_id, completed_lectures }
        if (!updates || !Array.isArray(updates)) {
            return res.status(400).json({ error: 'Updates array is required' });
        }

        const results = [];
        for (const update of updates) {
            const { data, error } = await supabase
                .from('aptitude_progress')
                .update({
                    completed_lectures: update.completed_lectures,
                    last_updated: new Date().toISOString()
                })
                .eq('student_id', update.student_id)
                .select()
                .single();

            if (!error) results.push(data);
        }

        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Failed to bulk update' });
    }
});

module.exports = router;
