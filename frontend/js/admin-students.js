/* ============================================
   Admin Students Management – JavaScript
   CRUD, search, filters, modals
   ============================================ */

var studentsData = [];
var coursesData = [];
var batchesData = [];
var centersData = [];

document.addEventListener('DOMContentLoaded', async function () {
    var user = await protectRoute('admin');
    if (!user) return;

    await loadDropdowns();
    await loadStudents();
    setupEventListeners();
});

// ---- Load dropdown data ----
async function loadDropdowns() {
    try {
        var results = await Promise.all([
            apiRequest('/courses'),
            apiRequest('/batches'),
            apiRequest('/centers')
        ]);
        coursesData = results[0];
        batchesData = results[1];
        centersData = results[2];

        populateSelect('filterCourse', coursesData, 'All Courses');
        populateSelect('filterBatch', batchesData, 'All Batches');
        populateSelect('filterCenter', centersData, 'All Centers');
        populateSelect('studentCourse', coursesData, 'Select Course');
        populateSelect('studentBatch', batchesData, 'Select Batch');
        populateSelect('studentCenter', centersData, 'Select Center');
    } catch (err) {
        console.error('Failed to load dropdowns:', err);
    }
}

function populateSelect(id, data, placeholder) {
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

// ---- Load Students ----
async function loadStudents() {
    try {
        var params = [];
        var courseFilter = document.getElementById('filterCourse');
        var batchFilter = document.getElementById('filterBatch');
        var centerFilter = document.getElementById('filterCenter');
        var statusFilter = document.getElementById('filterStatus');
        var searchInput = document.getElementById('studentSearch');

        if (courseFilter && courseFilter.value) params.push('course_id=' + courseFilter.value);
        if (batchFilter && batchFilter.value) params.push('batch_id=' + batchFilter.value);
        if (centerFilter && centerFilter.value) params.push('center_id=' + centerFilter.value);
        if (statusFilter && statusFilter.value) params.push('status=' + statusFilter.value);
        if (searchInput && searchInput.value.trim()) params.push('search=' + encodeURIComponent(searchInput.value.trim()));

        var query = params.length > 0 ? '?' + params.join('&') : '';
        studentsData = await apiRequest('/students' + query);
        renderStudents();
    } catch (err) {
        console.error('Failed to load students:', err);
        showToast('Failed to load students', 'error');
    }
}

function renderStudents() {
    var tbody = document.getElementById('studentsTableBody');
    var emptyState = document.getElementById('studentsEmpty');
    if (!tbody) return;

    if (studentsData.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    tbody.innerHTML = studentsData.map(function (s) {
        var statusClass = s.status === 'active' ? 'badge-success' : (s.status === 'completed' ? 'badge-primary' : 'badge-warning');
        return '<tr>' +
            '<td><strong>' + s.full_name + '</strong></td>' +
            '<td>' + s.email + '</td>' +
            '<td>' + (s.phone || '—') + '</td>' +
            '<td>' + (s.college_name || '—') + '</td>' +
            '<td>' + (s.courses ? s.courses.name : '—') + '</td>' +
            '<td>' + (s.batches ? s.batches.name : '—') + '</td>' +
            '<td>' + (s.training_centers ? s.training_centers.name : '—') + '</td>' +
            '<td><span class="badge ' + statusClass + '">' + s.status + '</span></td>' +
            '<td>' +
            '<div class="flex gap-sm">' +
            '<button class="btn btn-sm btn-secondary" onclick="editStudent(\'' + s.id + '\')"><i class="fa-solid fa-pen"></i></button>' +
            '<button class="btn btn-sm btn-danger" onclick="confirmDelete(\'' + s.id + '\', \'' + s.full_name.replace(/'/g, "\\'") + '\')"><i class="fa-solid fa-trash"></i></button>' +
            '</div></td></tr>';
    }).join('');
}

// ---- Event Listeners ----
function setupEventListeners() {
    // Add student button
    var addBtn = document.getElementById('addStudentBtn');
    if (addBtn) {
        addBtn.addEventListener('click', function () { openStudentModal(); });
    }

    // Search
    var searchInput = document.getElementById('studentSearch');
    if (searchInput) {
        var debounceTimer;
        searchInput.addEventListener('input', function () {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(loadStudents, 400);
        });
    }

    // Filters
    ['filterCourse', 'filterBatch', 'filterCenter', 'filterStatus'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('change', loadStudents);
    });

    // Student form submit
    var studentForm = document.getElementById('studentForm');
    if (studentForm) {
        studentForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            await saveStudent();
        });
    }

    // Modal close buttons
    document.querySelectorAll('.modal-close, [data-dismiss="modal"]').forEach(function (btn) {
        btn.addEventListener('click', closeAllModals);
    });

    // Close modal on overlay click
    document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeAllModals();
        });
    });
}

// ---- Modal Handlers ----
function openStudentModal(student) {
    var modal = document.getElementById('studentModal');
    var title = document.getElementById('studentModalTitle');
    var form = document.getElementById('studentForm');
    var submitBtn = document.getElementById('studentSubmitBtn');

    if (!modal || !form) return;

    form.reset();
    document.getElementById('studentId').value = '';

    if (student) {
        title.textContent = 'Edit Student';
        submitBtn.textContent = 'Update Student';
        document.getElementById('studentId').value = student.id;
        form.querySelector('[name="full_name"]').value = student.full_name || '';
        form.querySelector('[name="email"]').value = student.email || '';
        form.querySelector('[name="phone"]').value = student.phone || '';
        form.querySelector('[name="college_name"]').value = student.college_name || '';
        document.getElementById('studentCourse').value = student.course_id || '';
        document.getElementById('studentBatch').value = student.batch_id || '';
        document.getElementById('studentCenter').value = student.center_id || '';
        form.querySelector('[name="joining_date"]').value = student.joining_date || '';
    } else {
        title.textContent = 'Add Student';
        submitBtn.textContent = 'Add Student';
    }

    modal.classList.add('active');
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(function (m) {
        m.classList.remove('active');
    });
}

// ---- Edit Student ----
function editStudent(id) {
    var student = studentsData.find(function (s) { return s.id === id; });
    if (student) openStudentModal(student);
}

// ---- Save Student ----
async function saveStudent() {
    var form = document.getElementById('studentForm');
    var id = document.getElementById('studentId').value;

    var body = {
        full_name: form.querySelector('[name="full_name"]').value.trim(),
        email: form.querySelector('[name="email"]').value.trim(),
        phone: form.querySelector('[name="phone"]').value.trim(),
        college_name: form.querySelector('[name="college_name"]').value.trim(),
        course_id: document.getElementById('studentCourse').value || null,
        batch_id: document.getElementById('studentBatch').value || null,
        center_id: document.getElementById('studentCenter').value || null,
        joining_date: form.querySelector('[name="joining_date"]').value || null
    };

    if (!body.full_name || !body.email) {
        showToast('Full name and email are required', 'error');
        return;
    }

    if (!isValidEmail(body.email)) {
        showToast('Please enter a valid email', 'error');
        return;
    }

    try {
        if (id) {
            await apiRequest('/students/' + id, { method: 'PUT', body: body });
            showToast('Student updated successfully', 'success');
        } else {
            await apiRequest('/students', { method: 'POST', body: body });
            showToast('Student added successfully', 'success');
        }
        closeAllModals();
        await loadStudents();
    } catch (err) {
        showToast(err.message || 'Failed to save student', 'error');
    }
}

// ---- Delete Student ----
var deleteTargetId = null;

function confirmDelete(id, name) {
    deleteTargetId = id;
    var modal = document.getElementById('deleteModal');
    var nameEl = document.getElementById('deleteStudentName');
    if (nameEl) nameEl.textContent = name;
    if (modal) modal.classList.add('active');
}

async function deleteStudent() {
    if (!deleteTargetId) return;
    try {
        await apiRequest('/students/' + deleteTargetId, { method: 'DELETE' });
        showToast('Student deleted successfully', 'success');
        closeAllModals();
        deleteTargetId = null;
        await loadStudents();
    } catch (err) {
        showToast(err.message || 'Failed to delete student', 'error');
    }
}

// Make deleteStudent available globally
window.deleteStudent = deleteStudent;
