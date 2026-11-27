const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const DEFAULT_COURSES = [
    {
        name: 'Full Stack Web Development',
        description: 'Complete web development training covering frontend and backend technologies.',
        duration: '6 Months',
        technologies: 'HTML, CSS, JavaScript, React, Node.js, MongoDB',
        is_active: true
    },
    {
        name: 'Data Science & Analytics',
        description: 'Learn data analysis, machine learning, and visualization techniques.',
        duration: '4 Months',
        technologies: 'Python, Pandas, NumPy, Scikit-learn, Tableau',
        is_active: true
    },
    {
        name: 'Java Programming',
        description: 'Core and advanced Java programming with real-world projects.',
        duration: '3 Months',
        technologies: 'Java, Spring Boot, Hibernate, MySQL',
        is_active: true
    },
    {
        name: 'Python Programming',
        description: 'Python fundamentals to advanced concepts with hands-on projects.',
        duration: '3 Months',
        technologies: 'Python, Django, Flask, PostgreSQL',
        is_active: true
    },
    {
        name: 'Mobile App Development',
        description: 'Build cross-platform mobile applications.',
        duration: '5 Months',
        technologies: 'React Native, Flutter, Firebase',
        is_active: true
    },
    {
        name: 'UI/UX Design',
        description: 'User interface and experience design principles and tools.',
        duration: '3 Months',
        technologies: 'Figma, Adobe XD, Sketch, Prototyping',
        is_active: true
    }
];

// Get all courses (auto-seeds defaults if table is empty)
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('courses')
            .select('*')
            .order('name');

        if (error) return res.status(400).json({ error: error.message });

        if (!data || data.length === 0) {
            const { data: seeded, error: seedError } = await supabase
                .from('courses')
                .insert(DEFAULT_COURSES)
                .select();

            if (!seedError && seeded) {
                return res.json(seeded);
            }
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
});

// Get single course
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('courses')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) return res.status(404).json({ error: 'Course not found' });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch course' });
    }
});

// Create course (admin only)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { name, description, duration, technologies, fee } = req.body;
        if (!name) return res.status(400).json({ error: 'Course name is required' });

        const { data, error } = await supabase
            .from('courses')
            .insert({ name, description, duration, technologies, fee })
            .select()
            .single();

        if (error) return res.status(400).json({ error: error.message });
        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create course' });
    }
});

// Update course (admin only)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { name, description, duration, technologies, fee, is_active } = req.body;

        const { data, error } = await supabase
            .from('courses')
            .update({ name, description, duration, technologies, fee, is_active, updated_at: new Date().toISOString() })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update course' });
    }
});

// Delete course (admin only)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { error } = await supabase
            .from('courses')
            .delete()
            .eq('id', req.params.id);

        if (error) return res.status(400).json({ error: error.message });
        res.json({ message: 'Course deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete course' });
    }
});

module.exports = router;
