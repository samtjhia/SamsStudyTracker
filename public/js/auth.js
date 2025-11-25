const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const showSignupBtn = document.getElementById('show-signup');
const showLoginBtn = document.getElementById('show-login');
const authError = document.getElementById('auth-error');

showSignupBtn.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    authError.classList.add('hidden');
});

showLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    authError.classList.add('hidden');
});

document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (res.ok) {
        window.showDashboard();
    } else {
        authError.textContent = data.error;
        authError.classList.remove('hidden');
    }
});

document.getElementById('signup-btn').addEventListener('click', async () => {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const signupSecret = document.getElementById('signup-secret').value;

    const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, signupSecret })
    });

    const data = await res.json();
    if (res.ok) {
        window.showDashboard();
    } else {
        authError.textContent = data.error;
        authError.classList.remove('hidden');
    }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
});

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

// Add Enter key support for Login
triggerClickOnEnter('login-email', 'login-btn');
triggerClickOnEnter('login-password', 'login-btn');

// Add Enter key support for Signup
triggerClickOnEnter('signup-email', 'signup-btn');
triggerClickOnEnter('signup-password', 'signup-btn');
triggerClickOnEnter('signup-secret', 'signup-btn');
