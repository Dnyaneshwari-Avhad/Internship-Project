const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Get dashboard statistics
router.get('/stats', authMiddleware, adminOnly, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const [studentsRes, activeRes, batchesRes, attendanceRes, coursesRes, aptitudeRes] = await Promise.all([
            supabase.from('students').select('id', { count: 'exact' }),
            supabase.from('students').select('id', { count: 'exact' }).eq('status', 'active'),
            supabase.from('batches').select('id', { count: 'exact' }).eq('is_active', true),
            supabase.from('attendance').select('id', { count: 'exact' }).eq('date', today).eq('status', 'present'),
            supabase.from('courses').select('id', { count: 'exact' }).eq('is_active', true),
            supabase.from('aptitude_progress').select('completed_lectures, total_lectures')
        ]);

        // Calculate aptitude completion
        let totalLectures = 0;
        let completedLectures = 0;
        if (aptitudeRes.data) {
            aptitudeRes.data.forEach(a => {
                totalLectures += a.total_lectures;
                completedLectures += a.completed_lectures;
            });
        }

        res.json({
            total_students: studentsRes.data ? studentsRes.data.length : 0,
            active_students: activeRes.data ? activeRes.data.length : 0,
            total_batches: batchesRes.data ? batchesRes.data.length : 0,
            today_attendance: attendanceRes.data ? attendanceRes.data.length : 0,
            total_courses: coursesRes.data ? coursesRes.data.length : 0,
            aptitude_completed: completedLectures,
            aptitude_total: totalLectures
        });
    } catch (err) {
        console.error('Dashboard stats error:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
    }
});

// Get attendance chart data (last 7 days)
router.get('/attendance-chart', authMiddleware, adminOnly, async (req, res) => {
    try {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            days.push(d.toISOString().split('T')[0]);
        }

        const chartData = [];
        for (const day of days) {
            const { data: present } = await supabase
                .from('attendance')
                .select('id', { count: 'exact' })
                .eq('date', day)
                .eq('status', 'present');

            const { data: absent } = await supabase
                .from('attendance')
                .select('id', { count: 'exact' })
                .eq('date', day)
                .eq('status', 'absent');

            chartData.push({
                date: day,
                present: present ? present.length : 0,
                absent: absent ? absent.length : 0
            });
        }

        res.json(chartData);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch chart data' });
    }
});

// Get center-wise stats
router.get('/center-stats', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { data: centers } = await supabase
            .from('training_centers')
            .select('id, name');

        const stats = [];
        for (const center of centers || []) {
            const { data: students } = await supabase
                .from('students')
                .select('id', { count: 'exact' })
                .eq('center_id', center.id)
                .eq('status', 'active');

            const { data: batches } = await supabase
                .from('batches')
                .select('id', { count: 'exact' })
                .eq('center_id', center.id)
                .eq('is_active', true);

            stats.push({
                center_id: center.id,
                center_name: center.name,
                active_students: students ? students.length : 0,
                active_batches: batches ? batches.length : 0
            });
        }

        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch center stats' });
    }
});

module.exports = router;
