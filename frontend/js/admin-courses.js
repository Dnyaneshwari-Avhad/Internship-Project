/* ============================================
   Admin Courses Management – JavaScript
   CRUD operations for courses
   ============================================ */

var adminCoursesData = [];

document.addEventListener('DOMContentLoaded', async function () {
    var user = await protectRoute('admin');
    if (!user) return;

    await loadAdminCourses();
    setupCourseEvents();
});

async function loadAdminCourses() {
    try {
        adminCoursesData = await apiRequest('/courses');
        renderCoursesTable();
    } catch (err) {
        console.error('Failed to load courses:', err);
        showToast('Failed to load courses', 'error');
    }
}

function renderCoursesTable() {
    var tbody = document.getElementById('coursesTableBody');
    if (!tbody) return;

    if (adminCoursesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="table-empty"><i class="fa-solid fa-book"></i><br>No courses found</td></tr>';
        return;
    }

    tbody.innerHTML = adminCoursesData.map(function (c) {
        var statusBadge = c.is_active
            ? '<span class="badge badge-success">Active</span>'
            : '<span class="badge badge-warning">Inactive</span>';

        return '<tr>' +
            '<td><strong>' + c.name + '</strong></td>' +
            '<td>' + (c.duration || '—') + '</td>' +
            '<td>' + (c.technologies || '—') + '</td>' +
            '<td>' + statusBadge + '</td>' +
            '<td><div class="flex gap-sm">' +
            '<button class="btn btn-sm btn-secondary" onclick="editCourse(\'' + c.id + '\')"><i class="fa-solid fa-pen"></i></button>' +
            '<button class="btn btn-sm btn-danger" onclick="deleteCourse(\'' + c.id + '\')"><i class="fa-solid fa-trash"></i></button>' +
            '</div></td></tr>';
    }).join('');
}

function setupCourseEvents() {
    var addBtn = document.getElementById('addCourseBtn');
    if (addBtn) {
        addBtn.addEventListener('click', function () { openCourseModal(); });
    }

    var form = document.getElementById('courseForm');
    if (form) {
        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            await saveCourse();
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

function openCourseModal(course) {
    var modal = document.getElementById('courseModal');
    var title = document.getElementById('courseModalTitle');
    var form = document.getElementById('courseForm');

    if (!modal || !form) return;
    form.reset();
    document.getElementById('courseId').value = '';

    if (course) {
        title.textContent = 'Edit Course';
        document.getElementById('courseId').value = course.id;
        form.querySelector('[name="name"]').value = course.name || '';
        form.querySelector('[name="description"]').value = course.description || '';
        form.querySelector('[name="duration"]').value = course.duration || '';
        form.querySelector('[name="technologies"]').value = course.technologies || '';
        form.querySelector('[name="fee"]').value = course.fee || '';
    } else {
        title.textContent = 'Add Course';
    }

    modal.classList.add('active');
}

function editCourse(id) {
    var course = adminCoursesData.find(function (c) { return c.id === id; });
    if (course) openCourseModal(course);
}

async function saveCourse() {
    var form = document.getElementById('courseForm');
    var id = document.getElementById('courseId').value;

    var body = {
        name: form.querySelector('[name="name"]').value.trim(),
        description: form.querySelector('[name="description"]').value.trim(),
        duration: form.querySelector('[name="duration"]').value.trim(),
        technologies: form.querySelector('[name="technologies"]').value.trim(),
        fee: parseFloat(form.querySelector('[name="fee"]').value) || null
    };

    if (!body.name) {
        showToast('Course name is required', 'error');
        return;
    }

    try {
        if (id) {
            await apiRequest('/courses/' + id, { method: 'PUT', body: body });
            showToast('Course updated successfully', 'success');
        } else {
            await apiRequest('/courses', { method: 'POST', body: body });
            showToast('Course added successfully', 'success');
        }
        document.querySelectorAll('.modal-overlay').forEach(function (m) {
            m.classList.remove('active');
        });
        await loadAdminCourses();
    } catch (err) {
        showToast(err.message || 'Failed to save course', 'error');
    }
}

async function deleteCourse(id) {
    if (!confirm('Are you sure you want to delete this course?')) return;

    try {
        await apiRequest('/courses/' + id, { method: 'DELETE' });
        showToast('Course deleted successfully', 'success');
        await loadAdminCourses();
    } catch (err) {
        showToast(err.message || 'Failed to delete course', 'error');
    }
}

window.editCourse = editCourse;
window.deleteCourse = deleteCourse;
