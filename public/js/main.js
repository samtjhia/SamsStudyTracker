document.addEventListener('DOMContentLoaded', async () => {
    const authView = document.getElementById('auth-view');
    const dashboardView = document.getElementById('dashboard-view');
    
    // Dropdown Logic (Runs on all pages with the dropdown)
    const profileBtn = document.getElementById('profile-menu-btn');
    const dropdown = document.getElementById('profile-dropdown');
    
    if (profileBtn && dropdown) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.classList.contains('hidden') && !dropdown.contains(e.target) && !profileBtn.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });

        // Handle Logout in Dropdown
        const logoutBtn = document.getElementById('logout-btn-dropdown');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                const { error } = await window.supabase.auth.signOut();
                await fetch('/api/logout', { method: 'POST' });
                window.location.href = '/';
            });
        }
    }

    // Auth Check & Dashboard Logic (Only if views exist)
    if (authView && dashboardView) {
        try {
            const res = await fetch('/api/me');
            if (res.ok) {
                const data = await res.json();
                if (data.authenticated) {
                    // Update UI *before* showing dashboard to prevent placeholder flash
                    console.log("Authenticated user:", data.user);
                    updateProfileUI(data.user);
                    showDashboard();
                } else {
                    showAuth();
                }
            } else {
                showAuth();
            }
        } catch (err) {
            console.error(err);
            showAuth();
        }
    }

    function showAuth() {
        if (authView) authView.classList.remove('hidden');
        if (dashboardView) dashboardView.classList.add('hidden');
    }

    function showDashboard() {
        // Ensure auth is hidden
        if (authView) authView.classList.add('hidden');
        if (dashboardView) dashboardView.classList.remove('hidden');
        
        if (window.loadDashboardData) {
            window.loadDashboardData();
        }
    }
    
    window.updateProfileUI = (user) => {
        // 1. Text Updates
        const profileName = user.username || user.email.split('@')[0];
        const initial = profileName.charAt(0).toUpperCase();
        
        const initialEl = document.getElementById('profile-initial');
        const nameEl = document.getElementById('dropdown-name');
        const emailEl = document.getElementById('dropdown-email');

        if (initialEl) initialEl.textContent = initial;
        if (nameEl) { 
             nameEl.textContent = profileName;
             // Debugging log to see if this runs
             console.log("Updating nameEl to:", profileName);
        }
        if (emailEl) emailEl.textContent = user.email;

        // 2. Inject Menu Items (Ensures Settings & Logout buttons exist and are consistent with History page)
        // We replace the CONTENT of the menu, specifically the list of actions
        const listContainer = document.querySelector('#profile-dropdown .py-1');
        if (listContainer) {
            listContainer.innerHTML = `
                <!-- Mobile Tabs -->
                <a href="/app" class="md:hidden flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Dashboard
                </a>
                <a href="/history" class="md:hidden flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Calendar
                </a>
                
                <button id="settings-btn" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                </button>
                <button id="logout-btn-dropdown" class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                </button>
            `;
            
            // Re-attach listeners for the new elements
            const logoutBtn = document.getElementById('logout-btn-dropdown');
            const settingsBtn = document.getElementById('settings-btn');
            
            if (logoutBtn) {
                logoutBtn.addEventListener('click', async () => {
                    // 1. Clear Backend Session
                    try {
                        await fetch('/api/logout', { method: 'POST' });
                    } catch (e) {
                         console.error("Backend logout error:", e);
                    }
                    
                    // 2. Redirect to Home (Login Page)
                    window.location.href = '/';
                });
            }
            if (settingsBtn) {
                settingsBtn.addEventListener('click', () => {
                    const modal = document.getElementById('settings-modal');
                    if (modal) {
                         modal.classList.remove('hidden');
                         // Hide dropdown
                         document.getElementById('profile-dropdown').classList.add('hidden');
                         if (window.loadSettings) window.loadSettings();
                    }
                });
            }
        }
    };

    window.showAuth = showAuth;
    window.showDashboard = showDashboard;
});
