/* ============================================
   Admin Attendance – JavaScript
   Mark and view attendance records
   ============================================ */

var attendanceBatches = [];
var attendanceCenters = [];
var attendanceStudents = [];

document.addEventListener('DOMContentLoaded', async function () {
    var user = await protectRoute('admin');
    if (!user) return;

    await loadAttendanceDropdowns();
    loadAttendanceRecords();
    setupAttendanceEvents();

    // Set default date to today
    var dateInput = document.getElementById('attendanceDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
});

async function loadAttendanceDropdowns() {
    try {
        var results = await Promise.all([
            apiRequest('/batches'),
            apiRequest('/centers')
        ]);
        attendanceBatches = results[0];
        attendanceCenters = results[1];

        populateAttendanceSelect('attendanceBatch', attendanceBatches, 'Select Batch');
        populateAttendanceSelect('attendanceCenter', attendanceCenters, 'Select Center');
        populateAttendanceSelect('recordBatch', attendanceBatches, 'All Batches');
    } catch (err) {
        console.error('Failed to load attendance dropdowns:', err);
    }
}

function populateAttendanceSelect(id, data, placeholder) {
    var select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = '<option value="">' + placeholder + '</option>';
    data.forEach(function (item) {
        var option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        select.appendChild(option);
    });
}

function setupAttendanceEvents() {
    var loadBtn = document.getElementById('loadStudentsBtn');
    if (loadBtn) {
        loadBtn.addEventListener('click', loadStudentsForAttendance);
    }

    var saveBtn = document.getElementById('saveAttendanceBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveAttendance);
    }

    var recordDate = document.getElementById('recordDate');
    if (recordDate) {
        recordDate.addEventListener('change', loadAttendanceRecords);
    }

    var recordBatch = document.getElementById('recordBatch');
    if (recordBatch) {
        recordBatch.addEventListener('change', loadAttendanceRecords);
    }
}

// ---- Load students for marking attendance ----
async function loadStudentsForAttendance() {
    var batchId = document.getElementById('attendanceBatch').value;
    var date = document.getElementById('attendanceDate').value;

    if (!batchId) {
        showToast('Please select a batch', 'warning');
        return;
    }

    try {
        var query = date ? '?date=' + date : '';
        attendanceStudents = await apiRequest('/attendance/batch/' + batchId + '/students' + query);

        var tbody = document.getElementById('markAttendanceBody');
        var saveBtn = document.getElementById('saveAttendanceBtn');

        if (!tbody) return;

        if (attendanceStudents.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="table-empty"><i class="fa-solid fa-user-slash"></i><br>No students in this batch</td></tr>';
            if (saveBtn) saveBtn.classList.add('hidden');
            return;
        }

        if (saveBtn) saveBtn.classList.remove('hidden');

        tbody.innerHTML = attendanceStudents.map(function (s) {
            var presentActive = s.attendance_status === 'present' ? ' present' : '';
            var absentActive = s.attendance_status === 'absent' ? ' absent' : '';

            return '<tr data-student-id="' + s.id + '">' +
                '<td><strong>' + s.full_name + '</strong></td>' +
                '<td>' + s.email + '</td>' +
                '<td><div class="attendance-toggle">' +
                '<button class="att-btn' + presentActive + '" data-status="present" onclick="toggleAttendance(this)">Present</button>' +
                '<button class="att-btn' + absentActive + '" data-status="absent" onclick="toggleAttendance(this)">Absent</button>' +
                '</div></td></tr>';
        }).join('');
    } catch (err) {
        showToast('Failed to load students', 'error');
    }
}

function toggleAttendance(btn) {
    var toggle = btn.parentElement;
    toggle.querySelectorAll('.att-btn').forEach(function (b) {
        b.classList.remove('present', 'absent');
    });
    btn.classList.add(btn.dataset.status);
}

// ---- Save Attendance ----
async function saveAttendance() {
    var batchId = document.getElementById('attendanceBatch').value;
    var date = document.getElementById('attendanceDate').value;
    var rows = document.querySelectorAll('#markAttendanceBody tr[data-student-id]');

    var records = [];
    rows.forEach(function (row) {
        var studentId = row.dataset.studentId;
        var activeBtn = row.querySelector('.att-btn.present, .att-btn.absent');
        if (activeBtn) {
            records.push({
                student_id: studentId,
                batch_id: batchId,
                date: date,
                status: activeBtn.dataset.status
            });
        }
    });

    if (records.length === 0) {
        showToast('Please mark attendance for at least one student', 'warning');
        return;
    }

    try {
        await apiRequest('/attendance', { method: 'POST', body: { records: records } });
        showToast('Attendance saved successfully', 'success');
        loadAttendanceRecords();
    } catch (err) {
        showToast(err.message || 'Failed to save attendance', 'error');
    }
}

// ---- Load Attendance Records ----
async function loadAttendanceRecords() {
    try {
        var params = [];
        var recordDate = document.getElementById('recordDate');
        var recordBatch = document.getElementById('recordBatch');

        if (recordDate && recordDate.value) params.push('date=' + recordDate.value);
        if (recordBatch && recordBatch.value) params.push('batch_id=' + recordBatch.value);

        var query = params.length > 0 ? '?' + params.join('&') : '';
        var records = await apiRequest('/attendance' + query);

        var tbody = document.getElementById('attendanceRecordsBody');
        if (!tbody) return;

        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="table-empty"><i class="fa-solid fa-clipboard"></i><br>No attendance records found</td></tr>';
            return;
        }

        tbody.innerHTML = records.map(function (r) {
            var statusBadge = r.status === 'present'
                ? '<span class="badge badge-success">Present</span>'
                : '<span class="badge badge-danger">Absent</span>';
            return '<tr>' +
                '<td>' + formatDate(r.date) + '</td>' +
                '<td>' + (r.students ? r.students.full_name : '—') + '</td>' +
                '<td>' + (r.students && r.students.training_centers ? r.students.training_centers.name : '—') + '</td>' +
                '<td>' + statusBadge + '</td>' +
                '<td>' + formatDate(r.created_at) + '</td>' +
                '</tr>';
        }).join('');
    } catch (err) {
        console.error('Failed to load attendance records:', err);
    }
}
