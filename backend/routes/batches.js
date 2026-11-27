const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Get all batches (with optional filters)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { course_id, center_id, is_active } = req.query;
        let query = supabase
            .from('batches')
            .select(`
                *,
                courses(name),
                training_centers(name)
            `)
            .order('start_date', { ascending: false });

        if (course_id) query = query.eq('course_id', course_id);
        if (center_id) query = query.eq('center_id', center_id);
        if (is_active !== undefined) query = query.eq('is_active', is_active === 'true');

        const { data, error } = await query;
        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch batches' });
    }
});

// Get single batch with students
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { data: batch, error } = await supabase
            .from('batches')
            .select(`
                *,
                courses(name),
                training_centers(name),
                students(id, full_name, email, phone, status)
            `)
            .eq('id', req.params.id)
            .single();

        if (error) return res.status(404).json({ error: 'Batch not found' });
        res.json(batch);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch batch' });
    }
});

// Create batch (admin only)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { name, course_id, center_id, start_date, end_date, timing, max_students } = req.body;
        if (!name || !course_id || !center_id || !start_date) {
            return res.status(400).json({ error: 'Name, course, center and start date are required' });
        }

        const { data, error } = await supabase
            .from('batches')
            .insert({ name, course_id, center_id, start_date, end_date, timing, max_students })
            .select()
            .single();

        if (error) return res.status(400).json({ error: error.message });
        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create batch' });
    }
});

// Update batch (admin only)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { name, course_id, center_id, start_date, end_date, timing, max_students, is_active } = req.body;

        const { data, error } = await supabase
            .from('batches')
            .update({ name, course_id, center_id, start_date, end_date, timing, max_students, is_active, updated_at: new Date().toISOString() })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update batch' });
    }
});

// Delete batch (admin only)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { error } = await supabase
            .from('batches')
            .delete()
            .eq('id', req.params.id);

        if (error) return res.status(400).json({ error: error.message });
        res.json({ message: 'Batch deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete batch' });
    }
});

module.exports = router;
