/* ============================================
   Streamline Tech – Authentication Module
   Handles Sign In, Student Sign Up, Google OAuth,
   Forgot Password, Profile Completion, and
   Protected Routes.
   ALL keys come from .env via the backend.
   ============================================ */

const AUTH_ORIGIN = (window.APP_CONFIG && typeof window.APP_CONFIG.getBackendOrigin === 'function')
    ? window.APP_CONFIG.getBackendOrigin()
    : ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
        ? (window.location.port === '3000' ? window.location.origin : 'http://localhost:3000')
        : 'https://internship-project-backend-black.vercel.app');
const AUTH_API = AUTH_ORIGIN + '/api/auth';

let supabaseClientInstance = null;

// ---- Session Storage Helpers (supports Remember Me) ----
function getStorage() {
    if (localStorage.getItem('st_token')) return localStorage;
    if (sessionStorage.getItem('st_token')) return sessionStorage;
    return localStorage;
}

function getToken() {
    return localStorage.getItem('st_token') || sessionStorage.getItem('st_token');
}

function getUser() {
    var raw = localStorage.getItem('st_user') || sessionStorage.getItem('st_user');
    return raw ? JSON.parse(raw) : null;
}

function getProfile() {
    var raw = localStorage.getItem('st_profile') || sessionStorage.getItem('st_profile');
    return raw ? JSON.parse(raw) : null;
}

function setSession(token, user, profile, remember) {
    clearSession();
    var target = remember === false ? sessionStorage : localStorage;
    target.setItem('st_token', token);
    target.setItem('st_user', JSON.stringify(user));
    target.setItem('st_profile', JSON.stringify(profile));
}

function clearSession() {
    localStorage.removeItem('st_token');
    localStorage.removeItem('st_user');
    localStorage.removeItem('st_profile');
    sessionStorage.removeItem('st_token');
    sessionStorage.removeItem('st_user');
    sessionStorage.removeItem('st_profile');
}

// ---- Initialize Supabase Browser Client (Public Anon Key only) ----
async function getSupabaseClient() {
    if (supabaseClientInstance) return supabaseClientInstance;
    if (typeof window.supabase === 'undefined') return null;

    try {
        var res = await fetch(AUTH_API + '/config');
        if (!res.ok) return null;
        var cfg = await res.json();
        if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;

        supabaseClientInstance = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
        return supabaseClientInstance;
    } catch (err) {
        console.error('Failed to init Supabase client:', err);
        return null;
    }
}

// ---- Redirect Helper based on Role & Profile Completion ----
function redirectAfterAuth(data) {
    var role = data && data.profile ? data.profile.role : 'student';
    if (role === 'admin') {
        window.location.href = '/admin/dashboard';
        return;
    }
    if (data && data.needsProfileCompletion) {
        window.location.href = '/complete-profile';
        return;
    }
    window.location.href = '/student/dashboard';
}

// ---- Email & Password Login ----
async function login(email, password, remember) {
    var response = await fetch(AUTH_API + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password })
    });

    var data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Login failed');
    }

    setSession(data.session.access_token, data.user, data.profile, remember);
    return data;
}

// ---- Logout ----
async function logout() {
    clearSession();
    try {
        var client = await getSupabaseClient();
        if (client) {
            await client.auth.signOut();
        }
    } catch (e) {
        // Ignore signOut errors on client
    }
    window.location.href = '/login';
}

// ---- Verify Session ----
async function verifySession() {
    var token = getToken();
    if (!token) return null;

    try {
        var response = await fetch(AUTH_API + '/me', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!response.ok) {
            clearSession();
            return null;
        }

        var data = await response.json();
        var remember = Boolean(localStorage.getItem('st_token'));
        setSession(token, data.user, data.profile, remember);
        return data;
    } catch (err) {
        clearSession();
        return null;
    }
}

// ---- Protect Route ----
async function protectRoute(requiredRole) {
    var token = getToken();
    var profile = getProfile();

    if (!token || !profile) {
        window.location.href = '/login';
        return null;
    }

    var verified = await verifySession();
    if (!verified) {
        window.location.href = '/login';
        return null;
    }

    // Enforce strict role access
    if (requiredRole && verified.profile.role !== requiredRole) {
        if (verified.profile.role === 'admin') {
            window.location.href = '/admin/dashboard';
        } else if (verified.needsProfileCompletion) {
            window.location.href = '/complete-profile';
        } else {
            window.location.href = '/student/dashboard';
        }
        return null;
    }

    // Redirect incomplete student profiles to /complete-profile
    var isCompleteProfilePage = window.location.pathname.indexOf('complete-profile') !== -1;
    if (verified.profile.role === 'student' && verified.needsProfileCompletion && !isCompleteProfilePage) {
        window.location.href = '/complete-profile';
        return null;
    }

    if (verified.profile.role === 'student' && !verified.needsProfileCompletion && isCompleteProfilePage) {
        window.location.href = '/student/dashboard';
        return null;
    }

    return verified;
}

// ---- UI Helpers for Auth Pages ----
function showAuthError(msg) {
    var box = document.getElementById('authError');
    var text = document.getElementById('authErrorText');
    var success = document.getElementById('authSuccess');
    if (success) success.classList.remove('visible');
    if (box) {
        if (text) {
            text.textContent = msg;
        } else {
            box.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> ' + msg;
        }
        box.classList.add('visible');
    }
}

function showAuthSuccess(msg) {
    var box = document.getElementById('authSuccess');
    var text = document.getElementById('authSuccessText');
    var err = document.getElementById('authError');
    if (err) err.classList.remove('visible');
    if (box) {
        if (text) text.textContent = msg;
        box.classList.add('visible');
    }
}

function clearAuthMessages() {
    var err = document.getElementById('authError');
    var suc = document.getElementById('authSuccess');
    if (err) err.classList.remove('visible');
    if (suc) suc.classList.remove('visible');
}

function setAuthLoading(isLoading, label) {
    var loader = document.getElementById('authLoading');
    var loaderText = document.getElementById('authLoadingText');
    if (loaderText && label) loaderText.textContent = label;
    if (loader) {
        if (isLoading) loader.classList.add('visible');
        else loader.classList.remove('visible');
    }
}

function setupPasswordToggles() {
    document.querySelectorAll('.password-toggle').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var input = document.getElementById(this.dataset.target);
            if (!input) return;
            var isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            this.innerHTML = isPassword
                ? '<i class="fa-regular fa-eye-slash"></i>'
                : '<i class="fa-regular fa-eye"></i>';
            this.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
        });
    });
}

// ---- Load Public Centers & Courses for Dropdowns ----
async function loadAuthDropdowns(centerSelectId, courseSelectId, batchSelectId) {
    try {
        var requests = [
            fetch(AUTH_ORIGIN + '/api/centers').then(function (r) { return r.ok ? r.json() : []; }),
            fetch(AUTH_ORIGIN + '/api/courses').then(function (r) { return r.ok ? r.json() : []; })
        ];

        var token = getToken();
        if (batchSelectId && token) {
            requests.push(
                fetch(AUTH_ORIGIN + '/api/batches?is_active=true', {
                    headers: { 'Authorization': 'Bearer ' + token }
                }).then(function (r) { return r.ok ? r.json() : []; })
            );
        }

        var results = await Promise.all(requests);
        var centers = Array.isArray(results[0]) ? results[0] : [];
        var courses = Array.isArray(results[1]) ? results[1] : [];
        var batches = Array.isArray(results[2]) ? results[2] : [];

        populateDropdown(centerSelectId, centers, 'Select Training Center');
        populateDropdown(courseSelectId, courses, 'Select Course');
        if (batchSelectId) {
            populateDropdown(batchSelectId, batches, 'Not assigned / Select if known');
        }
    } catch (err) {
        console.error('Failed to load centers/courses:', err);
    }
}

function populateDropdown(id, items, placeholder) {
    var select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = '<option value="">' + placeholder + '</option>';
    items.forEach(function (item) {
        var opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = item.name;
        select.appendChild(opt);
    });
}

// ---- Dashboard Sidebar / Topbar User Info ----
function updateUserUI() {
    var profile = getProfile();
    if (!profile) return;

    var initials = profile.full_name
        ? profile.full_name.split(' ').map(function (w) { return w[0]; }).join('').toUpperCase().slice(0, 2)
        : '?';

    var sidebarUser = document.getElementById('sidebarUser');
    if (sidebarUser) {
        sidebarUser.innerHTML =
            '<div class="sidebar-user">' +
            '<div class="sidebar-user-avatar">' + initials + '</div>' +
            '<div class="sidebar-user-info">' +
            '<div class="sidebar-user-name">' + (profile.full_name || profile.email) + '</div>' +
            '<div class="sidebar-user-role">' + profile.role + '</div>' +
            '</div></div>';
    }

    var topBarUser = document.querySelector('.top-bar-user');
    if (topBarUser) {
        topBarUser.innerHTML =
            '<div class="top-bar-avatar">' + initials + '</div>' +
            '<span>' + (profile.full_name || profile.email) + '</span>';
    }
}

function setupSidebar() {
    var sidebar = document.querySelector('.sidebar');
    var toggle = document.querySelector('.sidebar-toggle');
    var closeBtn = document.querySelector('.sidebar-close');
    var overlay = document.querySelector('.sidebar-overlay');

    if (toggle && sidebar) {
        toggle.addEventListener('click', function () {
            sidebar.classList.add('open');
            if (overlay) overlay.classList.add('active');
        });
    }

    if (closeBtn && sidebar) {
        closeBtn.addEventListener('click', function () {
            sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('active');
        });
    }

    if (overlay && sidebar) {
        overlay.addEventListener('click', function () {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });
    }
}

function setupLogout() {
    document.querySelectorAll('.logout-btn, #logoutBtn').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            logout();
        });
    });
}

// ---- Handle Google OAuth Callback ----
async function handleOAuthCallbackIfPresent() {
    var hash = window.location.hash || '';
    var search = window.location.search || '';
    var params = new URLSearchParams(search);

    var oauthError = params.get('error_description') || params.get('error');
    if (oauthError) {
        showAuthError('Google sign-in was cancelled or failed: ' + decodeURIComponent(oauthError));
        window.history.replaceState({}, document.title, window.location.pathname);
        return true;
    }

    var hasOAuthParams = hash.indexOf('access_token=') !== -1 || params.has('code');
    if (!hasOAuthParams) return false;

    setAuthLoading(true, 'Completing Google sign-in...');
    try {
        var client = await getSupabaseClient();
        if (!client) {
            throw new Error('Supabase client not configured.');
        }

        // Supabase JS with detectSessionInUrl: true automatically exchanges PKCE code / parses hash.
        // Wait briefly for auth state if session isn't immediately populated.
        var sessionRes = await client.auth.getSession();
        var session = sessionRes.data ? sessionRes.data.session : null;

        if (!session) {
            session = await new Promise(function (resolve) {
                var resolved = false;
                var sub = client.auth.onAuthStateChange(function (_event, s) {
                    if (s && !resolved) {
                        resolved = true;
                        if (sub && sub.data && sub.data.subscription) sub.data.subscription.unsubscribe();
                        resolve(s);
                    }
                });
                setTimeout(function () {
                    if (!resolved) {
                        resolved = true;
                        if (sub && sub.data && sub.data.subscription) sub.data.subscription.unsubscribe();
                        resolve(null);
                    }
                }, 2500);
            });
        }

        if (!session || !session.access_token) {
            throw new Error('Could not verify Google login session. Please try again.');
        }

        var resp = await fetch(AUTH_API + '/oauth-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + session.access_token
            }
        });

        var data = await resp.json();
        if (!resp.ok) {
            throw new Error(data.error || 'Failed to complete Google sign-in.');
        }

        setSession(session.access_token, data.user, data.profile, true);
        window.history.replaceState({}, document.title, window.location.pathname);
        redirectAfterAuth(data);
        return true;
    } catch (err) {
        setAuthLoading(false);
        showAuthError(err.message || 'Google sign-in failed. Please try again or use email/password.');
        window.history.replaceState({}, document.title, window.location.pathname);
        return true;
    }
}

// ---- Page Initialization ----
document.addEventListener('DOMContentLoaded', async function () {
    setupPasswordToggles();
    setupSidebar();
    setupLogout();
    updateUserUI();

    var loginForm = document.getElementById('loginForm');
    var signupForm = document.getElementById('signupForm');
    var forgotForm = document.getElementById('forgotForm');
    var completeProfileForm = document.getElementById('completeProfileForm');

    // ---- 1. Login / Signup / Forgot Password Page ----
    if (loginForm && signupForm) {
        var handledOAuth = await handleOAuthCallbackIfPresent();
        if (handledOAuth && getToken()) return;

        // If already logged in, verify & redirect
        if (getToken() && getProfile()) {
            var verified = await verifySession();
            if (verified) {
                redirectAfterAuth(verified);
                return;
            }
        }

        loadAuthDropdowns('signupCenter', 'signupCourse');

        var authContainer = document.getElementById('authContainer');
        var authHeading = document.getElementById('authHeading');
        var authSubheading = document.getElementById('authSubheading');
        var oauthSection = document.getElementById('oauthSection');
        var tabSignIn = document.getElementById('tabSignIn');
        var tabSignUp = document.getElementById('tabSignUp');

        function switchAuthMode(mode) {
            clearAuthMessages();
            loginForm.classList.add('hidden');
            signupForm.classList.add('hidden');
            if (forgotForm) forgotForm.classList.add('hidden');

            if (mode === 'signup') {
                signupForm.classList.remove('hidden');
                if (oauthSection) oauthSection.classList.remove('hidden');
                if (authContainer) authContainer.classList.add('signup-mode');
                if (authHeading) authHeading.textContent = 'Create Student Account';
                if (authSubheading) authSubheading.textContent = 'Register to join Streamline Tech training programs';
                tabSignIn.classList.remove('active');
                tabSignUp.classList.add('active');
                tabSignIn.setAttribute('aria-selected', 'false');
                tabSignUp.setAttribute('aria-selected', 'true');
            } else if (mode === 'forgot') {
                if (forgotForm) forgotForm.classList.remove('hidden');
                if (oauthSection) oauthSection.classList.add('hidden');
                if (authContainer) authContainer.classList.remove('signup-mode');
                if (authHeading) authHeading.textContent = 'Reset Password';
                if (authSubheading) authSubheading.textContent = 'Enter your email to receive reset instructions';
            } else {
                loginForm.classList.remove('hidden');
                if (oauthSection) oauthSection.classList.remove('hidden');
                if (authContainer) authContainer.classList.remove('signup-mode');
                if (authHeading) authHeading.textContent = 'Welcome back';
                if (authSubheading) authSubheading.textContent = 'Sign in to access your Streamline Tech portal';
                tabSignIn.classList.add('active');
                tabSignUp.classList.remove('active');
                tabSignIn.setAttribute('aria-selected', 'true');
                tabSignUp.setAttribute('aria-selected', 'false');
            }
        }

        // Check URL query ?mode=signup
        var urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mode') === 'signup') {
            switchAuthMode('signup');
        }

        tabSignIn.addEventListener('click', function () { switchAuthMode('signin'); });
        tabSignUp.addEventListener('click', function () { switchAuthMode('signup'); });

        var showForgotBtn = document.getElementById('showForgotBtn');
        var backToSignInBtn = document.getElementById('backToSignInBtn');
        if (showForgotBtn) showForgotBtn.addEventListener('click', function () { switchAuthMode('forgot'); });
        if (backToSignInBtn) backToSignInBtn.addEventListener('click', function () { switchAuthMode('signin'); });

        // Google OAuth Button
        var googleBtn = document.getElementById('googleSignInBtn');
        if (googleBtn) {
            googleBtn.addEventListener('click', async function () {
                clearAuthMessages();
                googleBtn.disabled = true;
                setAuthLoading(true, 'Redirecting to Google...');

                try {
                    var client = await getSupabaseClient();
                    if (!client) {
                        throw new Error('Google sign-in is temporarily unavailable. Please use email/password or try again shortly.');
                    }
                    var redirectTo = window.location.origin + '/login';
                    var res = await client.auth.signInWithOAuth({
                        provider: 'google',
                        options: {
                            redirectTo: redirectTo,
                            queryParams: { prompt: 'select_account' }
                        }
                    });
                    if (res.error) throw res.error;
                } catch (err) {
                    setAuthLoading(false);
                    googleBtn.disabled = false;
                    showAuthError(err.message || 'Unable to start Google sign-in.');
                }
            });
        }

        // Sign In Submit
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            clearAuthMessages();

            var email = document.getElementById('loginEmail').value.trim();
            var password = document.getElementById('loginPassword').value;
            var remember = document.getElementById('rememberMe').checked;
            var submitBtn = document.getElementById('loginBtn');

            if (!email || !password) {
                showAuthError('Please enter both email and password.');
                return;
            }

            setAuthLoading(true, 'Signing in...');
            submitBtn.disabled = true;

            try {
                var data = await login(email, password, remember);
                redirectAfterAuth(data);
            } catch (err) {
                setAuthLoading(false);
                submitBtn.disabled = false;
                showAuthError(err.message || 'Invalid email or password.');
            }
        });

        // Student Sign Up Submit
        signupForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            clearAuthMessages();

            var payload = {
                first_name: document.getElementById('signupFirstName').value.trim(),
                last_name: document.getElementById('signupLastName').value.trim(),
                email: document.getElementById('signupEmail').value.trim(),
                phone: document.getElementById('signupPhone').value.trim(),
                date_of_birth: document.getElementById('signupDob').value,
                profile_image: document.getElementById('signupProfileImg').value.trim() || null,
                college_name: document.getElementById('signupCollege').value.trim(),
                branch: document.getElementById('signupBranch').value.trim(),
                academic_year: document.getElementById('signupYear').value,
                center_id: document.getElementById('signupCenter').value,
                course_id: document.getElementById('signupCourse').value,
                password: document.getElementById('signupPassword').value,
                confirm_password: document.getElementById('signupConfirmPassword').value
            };

            if (
                !payload.first_name || !payload.last_name || !payload.email || !payload.phone ||
                !payload.date_of_birth || !payload.college_name || !payload.branch ||
                !payload.academic_year || !payload.center_id || !payload.course_id ||
                !payload.password || !payload.confirm_password
            ) {
                showAuthError('Please complete all required fields.');
                return;
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
                showAuthError('Please enter a valid email address.');
                return;
            }

            var phoneDigits = payload.phone.replace(/\D/g, '');
            if (phoneDigits.length < 10 || phoneDigits.length > 15) {
                showAuthError('Please enter a valid 10-digit phone number.');
                return;
            }

            if (payload.password.length < 8 || !/[A-Za-z]/.test(payload.password) || !/[0-9]/.test(payload.password)) {
                showAuthError('Password must be at least 8 characters and include letters and numbers.');
                return;
            }

            if (payload.password !== payload.confirm_password) {
                showAuthError('Passwords do not match.');
                return;
            }

            var submitBtn = document.getElementById('signupBtn');
            setAuthLoading(true, 'Creating your student account...');
            submitBtn.disabled = true;

            try {
                var resp = await fetch(AUTH_API + '/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                var data = await resp.json();

                if (!resp.ok) {
                    throw new Error(data.error || 'Registration failed.');
                }

                if (data.requiresLogin) {
                    setAuthLoading(false);
                    submitBtn.disabled = false;
                    switchAuthMode('signin');
                    showAuthSuccess(data.message || 'Account created! Please sign in.');
                    return;
                }

                setSession(data.session.access_token, data.user, data.profile, true);
                if (typeof showToast === 'function') {
                    showToast('Welcome to Streamline Tech!', 'success');
                }
                redirectAfterAuth(data);
            } catch (err) {
                setAuthLoading(false);
                submitBtn.disabled = false;
                showAuthError(err.message || 'Registration failed.');
            }
        });

        // Forgot Password Submit
        if (forgotForm) {
            forgotForm.addEventListener('submit', async function (e) {
                e.preventDefault();
                clearAuthMessages();

                var email = document.getElementById('forgotEmail').value.trim();
                if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    showAuthError('Please enter a valid email address.');
                    return;
                }

                var forgotBtn = document.getElementById('forgotBtn');
                setAuthLoading(true, 'Sending reset link...');
                forgotBtn.disabled = true;

                try {
                    var resp = await fetch(AUTH_API + '/forgot-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: email,
                            redirectTo: window.location.origin + '/login'
                        })
                    });
                    var data = await resp.json();
                    if (!resp.ok) throw new Error(data.error || 'Failed to send reset link.');

                    setAuthLoading(false);
                    forgotBtn.disabled = false;
                    showAuthSuccess(data.message || 'Password reset link sent! Check your inbox.');
                } catch (err) {
                    setAuthLoading(false);
                    forgotBtn.disabled = false;
                    showAuthError(err.message || 'Unable to send reset link.');
                }
            });
        }
    }

    // ---- 2. Student Profile Completion Page ----
    if (completeProfileForm) {
        var authData = await protectRoute('student');
        if (!authData) return;

        await loadAuthDropdowns('cpCenter', 'cpCourse', 'cpBatch');

        // Prefill email and name from Google/Auth or existing student record
        var cpEmail = document.getElementById('cpEmail');
        var cpFirstName = document.getElementById('cpFirstName');
        var cpLastName = document.getElementById('cpLastName');
        var cpPhone = document.getElementById('cpPhone');
        var cpDob = document.getElementById('cpDob');
        var cpCollege = document.getElementById('cpCollege');
        var cpBranch = document.getElementById('cpBranch');
        var cpYear = document.getElementById('cpYear');
        var cpCenter = document.getElementById('cpCenter');
        var cpCourse = document.getElementById('cpCourse');
        var cpBatch = document.getElementById('cpBatch');

        if (cpEmail) cpEmail.value = authData.user.email || '';

        var existingStudent = authData.student || {};
        var fullNameSource = existingStudent.full_name || authData.profile.full_name || '';
        var nameParts = fullNameSource.trim().split(/\s+/);

        if (cpFirstName) cpFirstName.value = existingStudent.first_name || nameParts[0] || '';
        if (cpLastName) cpLastName.value = existingStudent.last_name || nameParts.slice(1).join(' ') || '';
        if (cpPhone && existingStudent.phone) cpPhone.value = existingStudent.phone;
        if (cpDob && existingStudent.date_of_birth) cpDob.value = existingStudent.date_of_birth;
        if (cpCollege && existingStudent.college_name) cpCollege.value = existingStudent.college_name;
        if (cpBranch && existingStudent.branch) cpBranch.value = existingStudent.branch;
        if (cpYear && existingStudent.academic_year) cpYear.value = existingStudent.academic_year;
        if (cpCenter && existingStudent.center_id) cpCenter.value = existingStudent.center_id;
        if (cpCourse && existingStudent.course_id) cpCourse.value = existingStudent.course_id;
        if (cpBatch && existingStudent.batch_id) cpBatch.value = existingStudent.batch_id;

        var cpLogoutLink = document.getElementById('cpLogoutLink');
        if (cpLogoutLink) {
            cpLogoutLink.addEventListener('click', function (e) {
                e.preventDefault();
                logout();
            });
        }

        completeProfileForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            clearAuthMessages();

            var payload = {
                first_name: cpFirstName.value.trim(),
                last_name: cpLastName.value.trim(),
                phone: cpPhone.value.trim(),
                date_of_birth: cpDob.value,
                college_name: cpCollege.value.trim(),
                branch: cpBranch.value.trim(),
                academic_year: cpYear.value,
                center_id: cpCenter.value,
                course_id: cpCourse.value,
                batch_id: cpBatch.value || null
            };

            if (
                !payload.first_name || !payload.last_name || !payload.phone ||
                !payload.date_of_birth || !payload.college_name || !payload.branch ||
                !payload.academic_year || !payload.center_id || !payload.course_id
            ) {
                showAuthError('Please fill in all required fields.');
                return;
            }

            var digits = payload.phone.replace(/\D/g, '');
            if (digits.length < 10 || digits.length > 15) {
                showAuthError('Please enter a valid 10-digit phone number.');
                return;
            }

            var btn = document.getElementById('completeProfileBtn');
            setAuthLoading(true, 'Saving your profile...');
            btn.disabled = true;

            try {
                var resp = await fetch(AUTH_API + '/complete-profile', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + getToken()
                    },
                    body: JSON.stringify(payload)
                });
                var data = await resp.json();
                if (!resp.ok) throw new Error(data.error || 'Failed to save profile.');

                var remember = Boolean(localStorage.getItem('st_token'));
                setSession(getToken(), getUser(), data.profile, remember);
                window.location.href = '/student/dashboard';
            } catch (err) {
                setAuthLoading(false);
                btn.disabled = false;
                showAuthError(err.message || 'Could not save profile.');
            }
        });
    }
});
