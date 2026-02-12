
// DOM Elements
const authView = document.getElementById('auth-view');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const registerGateForm = document.getElementById('register-gate-form');
const showSignupBtn = document.getElementById('show-signup');
const showLoginBtn = document.getElementById('show-login');
const authError = document.getElementById('auth-error');

// Toggle Forms
if (showSignupBtn) {
    showSignupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
        if (authError) authError.classList.add('hidden');
    });
}

if (showLoginBtn) {
    showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        signupForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        if (authError) authError.classList.add('hidden');
    });
}

// Initialize Supabase & Auth Logic
(async () => {
    try {
        const configRes = await fetch('/api/auth/config');
        const config = await configRes.json();
        
        if (!config.supabaseUrl || !config.supabaseAnonKey) {
            console.error('Missing Supabase configuration');
            return;
        }

        const supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

        // Google Login
        const googleBtn = document.getElementById('google-login-btn');
        if (googleBtn) {
            googleBtn.addEventListener('click', async () => {
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: window.location.origin + '/app'
                    }
                });
                if (error) showError(error.message);
            });
        }

        // Email Login
        const emailLoginBtn = document.getElementById('email-login-btn');
        if (emailLoginBtn) {
            emailLoginBtn.addEventListener('click', async () => {
                const email = document.getElementById('login-email').value;
                const password = document.getElementById('login-password').value;
                
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) showError(error.message);
                // Auth state change listener handles the rest
            });
        }

        // Email Signup
        const emailSignupBtn = document.getElementById('email-signup-btn');
        if (emailSignupBtn) {
            emailSignupBtn.addEventListener('click', async () => {
                const email = document.getElementById('signup-email').value;
                const password = document.getElementById('signup-password').value;

                const { data, error } = await supabase.auth.signUp({
                    email,
                    password
                });

                if (error) {
                    showError(error.message);
                } else if (data.user && !data.session) {
                    showError('Check your email for the confirmation link!');
                }
            });
        }

        // Complete Registration Gate
        const completeRegBtn = document.getElementById('complete-reg-btn');
        if (completeRegBtn) {
            completeRegBtn.addEventListener('click', async () => {
                const username = document.getElementById('reg-username').value;
                const signupSecret = document.getElementById('reg-secret').value;
                
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return showError('Session expired. Please login again.');

                const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        access_token: session.access_token,
                        username,
                        signupSecret
                    })
                });

                const data = await res.json();
                if (res.ok) {
                    // Success! Reload to trigger main app load
                    window.location.reload();
                } else {
                    showError(data.error);
                }
            });
        }

        // Auth Listener
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                if (session) {
                    // Sync with backend
                    const res = await fetch('/api/auth/login-sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ access_token: session.access_token })
                    });

                    const data = await res.json();

                    if (res.status === 404 && data.status === 'unregistered') {
                        // User needs to complete registration
                        loginForm.classList.add('hidden');
                        signupForm.classList.add('hidden');
                        registerGateForm.classList.remove('hidden');
                        if (authError) authError.classList.add('hidden');
                    } else if (res.ok) {
                        // All good
                        if (window.showDashboard) {
                            window.showDashboard();
                        } else {
                            // If showDashboard isn't defined yet (loading race), reload
                            window.location.reload();
                        }
                    } else {
                        showError(data.error || 'Login failed');
                    }
                }
            } else if (event === 'SIGNED_OUT') {
                // Ensure backend cookie is cleared
                await fetch('/api/logout', { method: 'POST' });
                window.location.href = '/';
            }
        });

        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await supabase.auth.signOut();
            });
        }

        // Helper to trigger button click on Enter key
        function triggerClickOnEnter(inputId, buttonId) {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        document.getElementById(buttonId).click();
                    }
                });
            }
        }

        triggerClickOnEnter('login-email', 'email-login-btn');
        triggerClickOnEnter('login-password', 'email-login-btn');

    } catch (e) {
        console.error('Auth Init Error:', e);
    }
})();

function showError(msg) {
    if (authError) {
        authError.textContent = msg;
        authError.classList.remove('hidden');
    }
}

