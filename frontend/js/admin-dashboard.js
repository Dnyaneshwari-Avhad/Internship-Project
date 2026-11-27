/* ============================================
   Admin Dashboard – JavaScript
   Stats, charts, recent students
   ============================================ */

document.addEventListener('DOMContentLoaded', async function () {
    // Protect route – admin only
    var user = await protectRoute('admin');
    if (!user) return;

    loadDashboardStats();
    loadAttendanceChart();
    loadRecentStudents();
    loadCenterStats();
});

// ---- Load Dashboard Statistics ----
async function loadDashboardStats() {
    try {
        var stats = await apiRequest('/dashboard/stats');

        setStatValue('totalStudents', stats.total_students);
        setStatValue('activeStudents', stats.active_students);
        setStatValue('totalBatches', stats.total_batches);
        setStatValue('todayAttendance', stats.today_attendance);
        setStatValue('aptitudeCompleted', stats.aptitude_completed + '/' + stats.aptitude_total);
    } catch (err) {
        console.error('Failed to load stats:', err);
    }
}

function setStatValue(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
}

// ---- Load Attendance Chart ----
async function loadAttendanceChart() {
    try {
        var chartData = await apiRequest('/dashboard/attendance-chart');
        var ctx = document.getElementById('attendanceChart');
        if (!ctx) return;

        var labels = chartData.map(function (d) {
            return new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        });
        var presentData = chartData.map(function (d) { return d.present; });
        var absentData = chartData.map(function (d) { return d.absent; });

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Present',
                        data: presentData,
                        backgroundColor: '#16a34a',
                        borderRadius: 4,
                        barPercentage: 0.6
                    },
                    {
                        label: 'Absent',
                        data: absentData,
                        backgroundColor: '#dc2626',
                        borderRadius: 4,
                        barPercentage: 0.6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 16,
                            font: { family: 'Inter', size: 12 }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { family: 'Inter', size: 11 } }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f0f2f5' },
                        ticks: {
                            stepSize: 1,
                            font: { family: 'Inter', size: 11 }
                        }
                    }
                }
            }
        });
    } catch (err) {
        console.error('Failed to load chart:', err);
    }
}

// ---- Load Recent Students ----
async function loadRecentStudents() {
    try {
        var students = await apiRequest('/students');
        var list = document.getElementById('recentStudents');
        if (!list) return;

        var recent = students.slice(0, 5);

        if (recent.length === 0) {
            list.innerHTML = '<li class="table-empty"><i class="fa-solid fa-users"></i>No students yet</li>';
            return;
        }

        list.innerHTML = recent.map(function (s) {
            var initials = s.full_name ? s.full_name.split(' ').map(function (w) { return w[0]; }).join('').toUpperCase().slice(0, 2) : '?';
            return '<li class="recent-item">' +
                '<div class="recent-item-avatar">' + initials + '</div>' +
                '<div class="recent-item-info">' +
                '<h5>' + s.full_name + '</h5>' +
                '<p>' + (s.courses ? s.courses.name : 'No course') + ' · ' + formatDate(s.joining_date) + '</p>' +
                '</div></li>';
        }).join('');
    } catch (err) {
        console.error('Failed to load recent students:', err);
    }
}

// ---- Load Center Stats ----
async function loadCenterStats() {
    try {
        var stats = await apiRequest('/dashboard/center-stats');
        var container = document.getElementById('centerStats');
        if (!container) return;

        container.innerHTML = stats.map(function (c) {
            return '<div class="stat-card">' +
                '<div class="stat-icon blue"><i class="fa-solid fa-building"></i></div>' +
                '<div class="stat-info">' +
                '<h3>' + c.active_students + '</h3>' +
                '<p>' + c.center_name + '</p>' +
                '<small class="text-muted">' + c.active_batches + ' active batches</small>' +
                '</div></div>';
        }).join('');
    } catch (err) {
        console.error('Failed to load center stats:', err);
    }
}
