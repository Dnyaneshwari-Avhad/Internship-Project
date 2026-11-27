const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

const DEFAULT_CENTERS = [
    {
        name: 'Nashik – Jatra Road',
        address: 'Jatra Road, Nashik, Maharashtra 422001',
        city: 'Nashik',
        phone: '+91 9876543210',
        is_active: true
    },
    {
        name: 'Nashik – College Road',
        address: 'College Road, Nashik, Maharashtra 422005',
        city: 'Nashik',
        phone: '+91 9876543211',
        is_active: true
    }
];

// Get all training centers (auto-seeds defaults if table is empty)
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('training_centers')
            .select('*')
            .order('name');

        if (error) return res.status(400).json({ error: error.message });

        const activeCenters = (data || []).filter(c => c.is_active !== false);

        if (activeCenters.length === 0 && (!data || data.length === 0)) {
            const { data: seeded, error: seedError } = await supabase
                .from('training_centers')
                .insert(DEFAULT_CENTERS)
                .select();

            if (!seedError && seeded) {
                return res.json(seeded);
            }
        }

        res.json(activeCenters);
    } catch (err) {
        console.error('Centers error:', err);
        res.status(500).json({ error: 'Failed to fetch training centers' });
    }
});

module.exports = router;
