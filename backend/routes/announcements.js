const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Get all announcements
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('announcements')
            .select(`
                *,
                training_centers(name)
            `)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch announcements' });
    }
});

// Create announcement (admin only)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { title, content, target, target_batch_id, center_id } = req.body;
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }

        const { data, error } = await supabase
            .from('announcements')
            .insert({
                title,
                content,
                target: target || 'all',
                target_batch_id: target_batch_id || null,
                center_id: center_id || null,
                created_by: req.user.id
            })
            .select()
            .single();

        if (error) return res.status(400).json({ error: error.message });
        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create announcement' });
    }
});

// Update announcement (admin only)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { title, content, target, target_batch_id, center_id, is_active } = req.body;

        const { data, error } = await supabase
            .from('announcements')
            .update({ title, content, target, target_batch_id, center_id, is_active, updated_at: new Date().toISOString() })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update announcement' });
    }
});

// Delete announcement (admin only)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { error } = await supabase
            .from('announcements')
            .delete()
            .eq('id', req.params.id);

        if (error) return res.status(400).json({ error: error.message });
        res.json({ message: 'Announcement deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete announcement' });
    }
});

module.exports = router;
