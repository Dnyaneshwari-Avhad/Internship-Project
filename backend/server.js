const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');

const studentRoutes = require('./routes/students');
const courseRoutes = require('./routes/courses');
const batchRoutes = require('./routes/batches');
const attendanceRoutes = require('./routes/attendance');
const aptitudeRoutes = require('./routes/aptitude');
const announcementRoutes = require('./routes/announcements');
const dashboardRoutes = require('./routes/dashboard');
const authRoutes = require('./routes/auth');
const centerRoutes = require('./routes/centers');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const configuredOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map(o => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

const allowedOrigins = Array.from(new Set([
    'https://streamlinetechintern.vercel.app',
    'http://localhost:3000',
    ...configuredOrigins
]));

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        const normalizedOrigin = origin.replace(/\/+$/, '');
        if (
            allowedOrigins.includes('*') ||
            allowedOrigins.includes(normalizedOrigin) ||
            /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin)
        ) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS: ' + origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/aptitude', aptitudeRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/centers', centerRoutes);

// Serve frontend pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'about.html')));
app.get('/courses', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'courses.html')));
app.get('/contact', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'contact.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'login.html')));
app.get('/complete-profile', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'complete-profile.html')));

// Admin pages
app.get('/admin/*', (req, res) => {
    const page = req.params[0] || 'dashboard';
    const filePath = path.join(__dirname, '..', 'frontend', 'admin', `${page}.html`);
    res.sendFile(filePath, (err) => {
        if (err) res.sendFile(path.join(__dirname, '..', 'frontend', 'admin', 'dashboard.html'));
    });
});

// Student pages
app.get('/student/*', (req, res) => {
    const page = req.params[0] || 'dashboard';
    const filePath = path.join(__dirname, '..', 'frontend', 'student', `${page}.html`);
    res.sendFile(filePath, (err) => {
        if (err) res.sendFile(path.join(__dirname, '..', 'frontend', 'student', 'dashboard.html'));
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Streamline Tech server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
