/* ============================================
   Student Dashboard – JavaScript
   Profile, attendance, aptitude, announcements
   ============================================ */

var studentData = null;
var studentAttendance = [];
var studentAptitude = null;

document.addEventListener('DOMContentLoaded', async function () {
    var user = await protectRoute('student');
    if (!user) return;

    await loadStudentData();
    setupStudentNav();
});

// ---- Load all student data ----
async function loadStudentData() {
    try {
        // Get student record
        var students = await apiRequest('/students');
        if (students.length > 0) {
            studentData = students[0];
        }

        if (!studentData) {
            showToast('Student profile not found', 'error');
            return;
        }

        // Load all data in parallel
        var results = await Promise.all([
            apiRequest('/attendance?student_id=' + studentData.id),
            apiRequest('/aptitude/' + studentData.id).catch(function () { return null; }),
            apiRequest('/announcements')
        ]);

        studentAttendance = results[0] || [];
        studentAptitude = results[1];
        var announcements = results[2] || [];

        renderOverview();
        renderProfile();
        renderAttendance();
        renderAptitude();
        renderAnnouncements(announcements);
    } catch (err) {
        console.error('Failed to load student data:', err);
        showToast('Failed to load your data', 'error');
    }
}

// ---- Render Overview ----
function renderOverview() {
    if (!studentData) return;

    // Welcome name
    var welcomeName = document.getElementById('welcomeName');
    if (welcomeName) welcomeName.textContent = studentData.full_name;

    // Attendance stats
    var totalDays = studentAttendance.length;
    var presentDays = studentAttendance.filter(function (a) { return a.status === 'present'; }).length;
    var percentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

    setStatText('attendancePercent', percentage + '%');
    setStatText('presentDays', presentDays);

    // Aptitude stats
    if (studentAptitude) {
        setStatText('aptCompleted', studentAptitude.completed_lectures);
        setStatText('aptRemaining', studentAptitude.total_lectures - studentAptitude.completed_lectures);
    }

    // Quick info
    var quickInfo = document.getElementById('quickInfo');
    if (quickInfo) {
        quickInfo.innerHTML =
            '<div class="profile-row"><span class="profile-row-label">Course</span><span class="profile-row-value">' + (studentData.courses ? studentData.courses.name : '—') + '</span></div>' +
            '<div class="profile-row"><span class="profile-row-label">Batch</span><span class="profile-row-value">' + (studentData.batches ? studentData.batches.name : '—') + '</span></div>' +
            '<div class="profile-row"><span class="profile-row-label">Center</span><span class="profile-row-value">' + (studentData.training_centers ? studentData.training_centers.name : '—') + '</span></div>' +
            '<div class="profile-row"><span class="profile-row-label">Joining Date</span><span class="profile-row-value">' + formatDate(studentData.joining_date) + '</span></div>';
    }
}

// ---- Render Profile ----
function renderProfile() {
    if (!studentData) return;

    var initials = getInitials(studentData.full_name);

    var avatar = document.getElementById('profileAvatar');
    if (avatar) avatar.textContent = initials;

    var profileName = document.getElementById('profileName');
    if (profileName) profileName.textContent = studentData.full_name;

    var profileEmail = document.getElementById('profileEmail');
    if (profileEmail) profileEmail.textContent = studentData.email;

    var details = document.getElementById('profileDetails');
    if (details) {
        details.innerHTML =
            profileRow('Full Name', studentData.full_name) +
            profileRow('Email', studentData.email) +
            profileRow('Phone', studentData.phone || '—') +
            profileRow('Date of Birth', studentData.date_of_birth ? formatDate(studentData.date_of_birth) : '—') +
            profileRow('College', studentData.college_name || '—') +
            profileRow('Branch / Department', studentData.branch || '—') +
            profileRow('Academic Year', studentData.academic_year || '—') +
            profileRow('Course', studentData.courses ? studentData.courses.name : '—') +
            profileRow('Batch', studentData.batches ? studentData.batches.name : '—') +
            profileRow('Center', studentData.training_centers ? studentData.training_centers.name : '—') +
            profileRow('Joining Date', formatDate(studentData.joining_date)) +
            profileRow('Status', '<span class="badge badge-success">' + studentData.status + '</span>');
    }
}

function profileRow(label, value) {
    return '<div class="profile-row"><span class="profile-row-label">' + label + '</span><span class="profile-row-value">' + value + '</span></div>';
}

// ---- Render Attendance ----
function renderAttendance() {
    var totalDays = studentAttendance.length;
    var presentDays = studentAttendance.filter(function (a) { return a.status === 'present'; }).length;
    var absentDays = totalDays - presentDays;
    var percentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

    var summary = document.getElementById('attendanceSummary');
    if (summary) {
        summary.innerHTML =
            '<div class="stats-grid">' +
            '<div class="stat-card"><div class="stat-icon blue"><i class="fa-solid fa-chart-pie"></i></div><div class="stat-info"><h3>' + percentage + '%</h3><p>Attendance Rate</p></div></div>' +
            '<div class="stat-card"><div class="stat-icon green"><i class="fa-solid fa-check"></i></div><div class="stat-info"><h3>' + presentDays + '</h3><p>Present Days</p></div></div>' +
            '<div class="stat-card"><div class="stat-icon red"><i class="fa-solid fa-xmark"></i></div><div class="stat-info"><h3>' + absentDays + '</h3><p>Absent Days</p></div></div>' +
            '</div>';
    }

    var tbody = document.getElementById('attendanceHistoryBody');
    if (tbody) {
        if (studentAttendance.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" class="table-empty">No attendance records yet</td></tr>';
            return;
        }

        tbody.innerHTML = studentAttendance.map(function (a) {
            var badge = a.status === 'present'
                ? '<span class="badge badge-success">Present</span>'
                : '<span class="badge badge-danger">Absent</span>';
            return '<tr><td>' + formatDate(a.date) + '</td><td>' + badge + '</td></tr>';
        }).join('');
    }
}

// ---- Render Aptitude ----
function renderAptitude() {
    var container = document.getElementById('aptitudeDetails');
    if (!container) return;

    if (!studentAptitude) {
        container.innerHTML = '<div class="table-empty"><i class="fa-solid fa-brain"></i><br>No aptitude records found</div>';
        return;
    }

    var total = studentAptitude.total_lectures;
    var completed = studentAptitude.completed_lectures;
    var remaining = total - completed;
    var percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    container.innerHTML =
        '<div class="stats-grid">' +
        '<div class="stat-card"><div class="stat-icon blue"><i class="fa-solid fa-book"></i></div><div class="stat-info"><h3>' + total + '</h3><p>Total Lectures</p></div></div>' +
        '<div class="stat-card"><div class="stat-icon green"><i class="fa-solid fa-check-double"></i></div><div class="stat-info"><h3>' + completed + '</h3><p>Completed</p></div></div>' +
        '<div class="stat-card"><div class="stat-icon orange"><i class="fa-solid fa-hourglass-half"></i></div><div class="stat-info"><h3>' + remaining + '</h3><p>Remaining</p></div></div>' +
        '</div>' +
        '<div class="card mt-lg" style="padding:20px">' +
        '<h4 style="margin-bottom:12px">Progress</h4>' +
        '<div class="progress-bar" style="height:12px"><div class="progress-fill" style="width:' + percentage + '%"></div></div>' +
        '<p class="text-muted mt-sm">' + percentage + '% complete</p>' +
        (studentAptitude.notes ? '<p class="mt-md"><strong>Notes:</strong> ' + studentAptitude.notes + '</p>' : '') +
        '</div>';
}

// ---- Render Announcements ----
function renderAnnouncements(announcements) {
    var container = document.getElementById('announcementsList');
    if (!container) return;

    if (announcements.length === 0) {
        container.innerHTML = '<div class="table-empty"><i class="fa-solid fa-bullhorn"></i><br>No announcements</div>';
        return;
    }

    container.innerHTML = announcements.map(function (a) {
        return '<div class="announcement-card">' +
            '<h4>' + a.title + '</h4>' +
            '<p>' + a.content + '</p>' +
            '<span class="announcement-date"><i class="fa-solid fa-clock"></i> ' + formatDate(a.created_at) + '</span>' +
            '</div>';
    }).join('');
}

// ---- Section Navigation ----
function setupStudentNav() {
    var links = document.querySelectorAll('.sidebar-link[data-section]');
    links.forEach(function (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();

            // Update active link
            links.forEach(function (l) { l.classList.remove('active'); });
            this.classList.add('active');

            // Show target section
            var sectionId = this.dataset.section + 'Section';
            document.querySelectorAll('[id$="Section"]').forEach(function (sec) {
                sec.classList.add('hidden');
            });
            var target = document.getElementById(sectionId);
            if (target) target.classList.remove('hidden');

            // Update page title
            var pageTitle = document.querySelector('.page-title');
            if (pageTitle) pageTitle.textContent = this.textContent.trim();

            // Close mobile sidebar
            var sidebar = document.querySelector('.sidebar');
            var overlay = document.querySelector('.sidebar-overlay');
            if (sidebar) sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('active');
        });
    });
}

function setStatText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
}
