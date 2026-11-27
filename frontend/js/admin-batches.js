/* ============================================
   Admin Batches Management – JavaScript
   CRUD operations for batches
   ============================================ */

var adminBatchesData = [];
var batchCoursesData = [];
var batchCentersData = [];

document.addEventListener('DOMContentLoaded', async function () {
    var user = await protectRoute('admin');
    if (!user) return;

    await loadBatchDropdowns();
    await loadAdminBatches();
    setupBatchEvents();
});

async function loadBatchDropdowns() {
    try {
        var results = await Promise.all([
            apiRequest('/courses'),
            apiRequest('/centers')
        ]);
        batchCoursesData = results[0];
        batchCentersData = results[1];

        populateBatchSelect('batchFilterCourse', batchCoursesData, 'All Courses');
        populateBatchSelect('batchFilterCenter', batchCentersData, 'All Centers');
        populateBatchSelect('batchCourse', batchCoursesData, 'Select Course');
        populateBatchSelect('batchCenter', batchCentersData, 'Select Center');
    } catch (err) {
        console.error('Failed to load batch dropdowns:', err);
    }
}

function populateBatchSelect(id, data, placeholder) {
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

async function loadAdminBatches() {
    try {
        var params = [];
        var courseFilter = document.getElementById('batchFilterCourse');
        var centerFilter = document.getElementById('batchFilterCenter');

        if (courseFilter && courseFilter.value) params.push('course_id=' + courseFilter.value);
        if (centerFilter && centerFilter.value) params.push('center_id=' + centerFilter.value);

        var query = params.length > 0 ? '?' + params.join('&') : '';
        adminBatchesData = await apiRequest('/batches' + query);
        renderBatchesTable();
    } catch (err) {
        console.error('Failed to load batches:', err);
        showToast('Failed to load batches', 'error');
    }
}

function renderBatchesTable() {
    var tbody = document.getElementById('batchesTableBody');
    if (!tbody) return;

    if (adminBatchesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="table-empty"><i class="fa-solid fa-layer-group"></i><br>No batches found</td></tr>';
        return;
    }

    tbody.innerHTML = adminBatchesData.map(function (b) {
        var statusBadge = b.is_active
            ? '<span class="badge badge-success">Active</span>'
            : '<span class="badge badge-warning">Inactive</span>';

        return '<tr>' +
            '<td><strong>' + b.name + '</strong></td>' +
            '<td>' + (b.courses ? b.courses.name : '—') + '</td>' +
            '<td>' + (b.training_centers ? b.training_centers.name : '—') + '</td>' +
            '<td>' + formatDate(b.start_date) + '</td>' +
            '<td>' + formatDate(b.end_date) + '</td>' +
            '<td>' + (b.timing || '—') + '</td>' +
            '<td>' + (b.max_students || '—') + '</td>' +
            '<td>' + statusBadge + '</td>' +
            '<td><div class="flex gap-sm">' +
            '<button class="btn btn-sm btn-secondary" onclick="editBatch(\'' + b.id + '\')"><i class="fa-solid fa-pen"></i></button>' +
            '<button class="btn btn-sm btn-danger" onclick="deleteBatch(\'' + b.id + '\')"><i class="fa-solid fa-trash"></i></button>' +
            '</div></td></tr>';
    }).join('');
}

function setupBatchEvents() {
    var addBtn = document.getElementById('addBatchBtn');
    if (addBtn) {
        addBtn.addEventListener('click', function () { openBatchModal(); });
    }

    ['batchFilterCourse', 'batchFilterCenter'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('change', loadAdminBatches);
    });

    var form = document.getElementById('batchForm');
    if (form) {
        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            await saveBatch();
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

function openBatchModal(batch) {
    var modal = document.getElementById('batchModal');
    var title = document.getElementById('batchModalTitle');
    var form = document.getElementById('batchForm');

    if (!modal || !form) return;
    form.reset();
    document.getElementById('batchId').value = '';

    if (batch) {
        title.textContent = 'Edit Batch';
        document.getElementById('batchId').value = batch.id;
        form.querySelector('[name="name"]').value = batch.name || '';
        document.getElementById('batchCourse').value = batch.course_id || '';
        document.getElementById('batchCenter').value = batch.center_id || '';
        form.querySelector('[name="start_date"]').value = batch.start_date || '';
        form.querySelector('[name="end_date"]').value = batch.end_date || '';
        form.querySelector('[name="timing"]').value = batch.timing || '';
        form.querySelector('[name="max_students"]').value = batch.max_students || '';
    } else {
        title.textContent = 'Add Batch';
    }

    modal.classList.add('active');
}

function editBatch(id) {
    var batch = adminBatchesData.find(function (b) { return b.id === id; });
    if (batch) openBatchModal(batch);
}

async function saveBatch() {
    var form = document.getElementById('batchForm');
    var id = document.getElementById('batchId').value;

    var body = {
        name: form.querySelector('[name="name"]').value.trim(),
        course_id: document.getElementById('batchCourse').value || null,
        center_id: document.getElementById('batchCenter').value || null,
        start_date: form.querySelector('[name="start_date"]').value || null,
        end_date: form.querySelector('[name="end_date"]').value || null,
        timing: form.querySelector('[name="timing"]').value.trim() || null,
        max_students: parseInt(form.querySelector('[name="max_students"]').value) || null
    };

    if (!body.name || !body.course_id || !body.center_id || !body.start_date) {
        showToast('Name, course, center and start date are required', 'error');
        return;
    }

    try {
        if (id) {
            await apiRequest('/batches/' + id, { method: 'PUT', body: body });
            showToast('Batch updated successfully', 'success');
        } else {
            await apiRequest('/batches', { method: 'POST', body: body });
            showToast('Batch added successfully', 'success');
        }
        document.querySelectorAll('.modal-overlay').forEach(function (m) {
            m.classList.remove('active');
        });
        await loadAdminBatches();
    } catch (err) {
        showToast(err.message || 'Failed to save batch', 'error');
    }
}

async function deleteBatch(id) {
    if (!confirm('Are you sure you want to delete this batch?')) return;

    try {
        await apiRequest('/batches/' + id, { method: 'DELETE' });
        showToast('Batch deleted successfully', 'success');
        await loadAdminBatches();
    } catch (err) {
        showToast(err.message || 'Failed to delete batch', 'error');
    }
}

window.editBatch = editBatch;
window.deleteBatch = deleteBatch;
