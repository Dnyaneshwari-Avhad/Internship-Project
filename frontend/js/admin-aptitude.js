/* ============================================
   Admin Aptitude Progress – JavaScript
   Track and update student aptitude lectures
   ============================================ */

var aptitudeData = [];

document.addEventListener('DOMContentLoaded', async function () {
    var user = await protectRoute('admin');
    if (!user) return;

    await loadAptitudeProgress();
    setupAptitudeEvents();
});

async function loadAptitudeProgress() {
    try {
        aptitudeData = await apiRequest('/aptitude');
        renderAptitudeTable();
        updateAptitudeSummary();
    } catch (err) {
        console.error('Failed to load aptitude:', err);
        showToast('Failed to load aptitude progress', 'error');
    }
}

function updateAptitudeSummary() {
    if (aptitudeData.length === 0) return;

    var totalLectures = 0;
    var totalCompleted = 0;

    aptitudeData.forEach(function (a) {
        totalLectures += a.total_lectures;
        totalCompleted += a.completed_lectures;
    });

    var avgCompleted = Math.round(totalCompleted / aptitudeData.length);
    var avgRemaining = Math.round((totalLectures - totalCompleted) / aptitudeData.length);

    setStatText('aptTotalLectures', aptitudeData.length > 0 ? aptitudeData[0].total_lectures : 0);
    setStatText('aptAvgCompleted', avgCompleted);
    setStatText('aptAvgRemaining', avgRemaining);
}

function setStatText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
}

function renderAptitudeTable() {
    var tbody = document.getElementById('aptitudeTableBody');
    if (!tbody) return;

    var searchVal = '';
    var searchInput = document.getElementById('aptitudeSearch');
    if (searchInput) searchVal = searchInput.value.trim().toLowerCase();

    var filtered = aptitudeData;
    if (searchVal) {
        filtered = aptitudeData.filter(function (a) {
            return (a.students && a.students.full_name && a.students.full_name.toLowerCase().indexOf(searchVal) !== -1) ||
                (a.students && a.students.email && a.students.email.toLowerCase().indexOf(searchVal) !== -1);
        });
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="table-empty"><i class="fa-solid fa-brain"></i><br>No aptitude records found</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(function (a) {
        var remaining = a.total_lectures - a.completed_lectures;
        var percentage = a.total_lectures > 0 ? Math.round((a.completed_lectures / a.total_lectures) * 100) : 0;

        return '<tr>' +
            '<td><strong>' + (a.students ? a.students.full_name : '—') + '</strong></td>' +
            '<td>' + (a.students ? a.students.email : '—') + '</td>' +
            '<td>' + (a.students && a.students.batches ? a.students.batches.name : '—') + '</td>' +
            '<td>' + a.total_lectures + '</td>' +
            '<td>' + a.completed_lectures + '</td>' +
            '<td>' + remaining + '</td>' +
            '<td><div class="progress-bar"><div class="progress-fill" style="width:' + percentage + '%"></div></div><small class="text-muted">' + percentage + '%</small></td>' +
            '<td><button class="btn btn-sm btn-secondary" onclick="editAptitude(\'' + a.student_id + '\')"><i class="fa-solid fa-pen"></i></button></td>' +
            '</tr>';
    }).join('');
}

function setupAptitudeEvents() {
    var searchInput = document.getElementById('aptitudeSearch');
    if (searchInput) {
        searchInput.addEventListener('input', renderAptitudeTable);
    }

    var form = document.getElementById('aptitudeForm');
    if (form) {
        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            await saveAptitude();
        });
    }

    document.querySelectorAll('.modal-close, [data-dismiss="modal"]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.modal-overlay').forEach(function (m) {
                m.classList.remove('active');
            });
        });
    });

    document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });
}

function editAptitude(studentId) {
    var record = aptitudeData.find(function (a) { return a.student_id === studentId; });
    if (!record) return;

    var modal = document.getElementById('aptitudeModal');
    var nameEl = document.getElementById('aptStudentName');
    var totalInput = document.getElementById('aptTotalInput');
    var completedInput = document.getElementById('aptCompletedInput');
    var notesInput = document.getElementById('aptNotesInput');
    var idInput = document.getElementById('aptStudentId');

    if (nameEl) nameEl.textContent = record.students ? record.students.full_name : '';
    if (totalInput) totalInput.value = record.total_lectures;
    if (completedInput) completedInput.value = record.completed_lectures;
    if (notesInput) notesInput.value = record.notes || '';
    if (idInput) idInput.value = studentId;

    if (modal) modal.classList.add('active');
}

async function saveAptitude() {
    var studentId = document.getElementById('aptStudentId').value;
    var totalInput = document.getElementById('aptTotalInput');
    var completedInput = document.getElementById('aptCompletedInput');
    var notesInput = document.getElementById('aptNotesInput');

    var total = parseInt(totalInput.value) || 0;
    var completed = parseInt(completedInput.value) || 0;

    if (completed > total) {
        showToast('Completed cannot exceed total lectures', 'error');
        return;
    }

    try {
        await apiRequest('/aptitude/' + studentId, {
            method: 'PUT',
            body: {
                total_lectures: total,
                completed_lectures: completed,
                notes: notesInput ? notesInput.value : ''
            }
        });
        showToast('Aptitude progress updated', 'success');
        document.querySelectorAll('.modal-overlay').forEach(function (m) {
            m.classList.remove('active');
        });
        await loadAptitudeProgress();
    } catch (err) {
        showToast(err.message || 'Failed to update', 'error');
    }
}

window.editAptitude = editAptitude;
