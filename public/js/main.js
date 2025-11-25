document.addEventListener('DOMContentLoaded', async () => {
    const authView = document.getElementById('auth-view');
    const dashboardView = document.getElementById('dashboard-view');

    // Check auth status
    try {
        const res = await fetch('/api/me');
        const data = await res.json();

        if (data.authenticated) {
            showDashboard();
        } else {
            showAuth();
        }
    } catch (err) {
        showAuth();
    }

    function showAuth() {
        authView.classList.remove('hidden');
        dashboardView.classList.add('hidden');
    }

    function showDashboard() {
        authView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        if (window.loadDashboardData) {
            window.loadDashboardData();
        }
    }

    window.showAuth = showAuth;
    window.showDashboard = showDashboard;
});
