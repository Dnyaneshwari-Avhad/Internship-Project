const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Get attendance records (with filters)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { batch_id, date, student_id, center_id } = req.query;
        let query = supabase
            .from('attendance')
            .select(`
                *,
                students(full_name, email, center_id, training_centers(name))
            `)
            .order('date', { ascending: false });

        if (batch_id) query = query.eq('batch_id', batch_id);
        if (date) query = query.eq('date', date);
        if (student_id) query = query.eq('student_id', student_id);

        // Students can only see their own attendance
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
        console.error('Get attendance error:', err);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
});

// Get attendance summary for a student
router.get('/summary/:studentId', authMiddleware, async (req, res) => {
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

        const { data: total, error: totalError } = await supabase
            .from('attendance')
            .select('id', { count: 'exact' })
            .eq('student_id', req.params.studentId);

        const { data: present, error: presentError } = await supabase
            .from('attendance')
            .select('id', { count: 'exact' })
            .eq('student_id', req.params.studentId)
            .eq('status', 'present');

        if (totalError || presentError) {
            return res.status(400).json({ error: 'Failed to get attendance summary' });
        }

        const totalCount = total.length;
        const presentCount = present.length;
        const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

        res.json({
            total: totalCount,
            present: presentCount,
            absent: totalCount - presentCount,
            percentage
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get attendance summary' });
    }
});

// Mark attendance (admin only)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { records } = req.body; // Array of { student_id, batch_id, date, status }
        if (!records || !Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ error: 'Attendance records are required' });
        }

        const attendanceData = records.map(r => ({
            student_id: r.student_id,
            batch_id: r.batch_id,
            date: r.date || new Date().toISOString().split('T')[0],
            status: r.status,
            marked_by: req.user.id
        }));

        const { data, error } = await supabase
            .from('attendance')
            .upsert(attendanceData, { onConflict: 'student_id,date' })
            .select();

        if (error) return res.status(400).json({ error: error.message });
        res.status(201).json(data);
    } catch (err) {
        console.error('Mark attendance error:', err);
        res.status(500).json({ error: 'Failed to mark attendance' });
    }
});

// Get students for attendance (by batch)
router.get('/batch/:batchId/students', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];

        const { data: students, error } = await supabase
            .from('students')
            .select('id, full_name, email')
            .eq('batch_id', req.params.batchId)
            .eq('status', 'active')
            .order('full_name');

        if (error) return res.status(400).json({ error: error.message });

        // Get existing attendance for the date
        const { data: existingAttendance } = await supabase
            .from('attendance')
            .select('student_id, status')
            .eq('batch_id', req.params.batchId)
            .eq('date', targetDate);

        const attendanceMap = {};
        if (existingAttendance) {
            existingAttendance.forEach(a => { attendanceMap[a.student_id] = a.status; });
        }

        const result = students.map(s => ({
            ...s,
            attendance_status: attendanceMap[s.id] || null
        }));

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch students for attendance' });
    }
});

module.exports = router;
