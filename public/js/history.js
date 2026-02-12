const calendarGrid = document.getElementById('calendar-grid');
const currentMonthLabel = document.getElementById('current-month-label');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const dayDetails = document.getElementById('day-details');
const selectedDateLabel = document.getElementById('selected-date-label');
const dayTotalTimeEl = document.getElementById('day-total-time');
const daySessionListEl = document.getElementById('day-session-list');
const logoutBtn = document.getElementById('logout-btn');

let currentDate = new Date();
let sessionsCache = [];
let isAuthenticated = false;
let currentUser = null;

// Initialize Supabase & Check Auth on Load
(async function init() {
    try {
        // 1. Load Config
        const configRes = await fetch('/api/auth/config');
        const config = await configRes.json();

        if (config.supabaseUrl && config.supabaseAnonKey) {
            const supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

            // 2. Setup Auth Listener (Prevents random logouts when switching pages)
            supabase.auth.onAuthStateChange(async (event, session) => {
                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    // Sync backend cookie if needed
                    if (session) {
                        try {
                            const syncRes = await fetch('/api/auth/login-sync', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ access_token: session.access_token })
                            });
                            
                            if (syncRes.ok) {
                                const syncData = await syncRes.json();
                                const wasAuthenticated = isAuthenticated;
                                isAuthenticated = true;
                                if (syncData.user) currentUser = syncData.user;
                                updateUIForAuth();
                                
                                // FORCE RE-RENDER if we just logged in (to switch from Public -> Private data)
                                if (!wasAuthenticated) {
                                    renderCalendar();
                                }
                            }
                        } catch (e) {
                            console.error('Sync failed', e);
                        }
                    }
                } else if (event === 'SIGNED_OUT') {
                    const wasAuthenticated = isAuthenticated;
                    isAuthenticated = false;
                    currentUser = null;
                    updateUIForAuth();
                    
                    if (wasAuthenticated) {
                        renderCalendar(); // Switch back to public view
                    }
                }
            });
        }

        // 3. Check Backend Cookie (Source of Truth for Data)
        const res = await fetch('/api/me');
        const data = await res.json();
        isAuthenticated = data.authenticated;
        if (isAuthenticated) {
            currentUser = data.user;
        }

        updateUIForAuth();
        renderCalendar();
    } catch (err) {
        console.error('History Init Error:', err);
        isAuthenticated = false;
        currentUser = null;
        updateUIForAuth();
        renderCalendar();
    }
})();

function updateUIForAuth() {
    const navRight = document.querySelector('nav > div.relative');
    
    if (isAuthenticated && currentUser) {
        // Restore/Ensure Dropdown UI is present if it was replaced
        if (!document.getElementById('profile-menu-btn')) {
            navRight.innerHTML = `
                <button id="profile-menu-btn" class="flex items-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-full">
                    <div class="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-lg hover:bg-indigo-700 transition-colors shadow-sm">
                        <span id="profile-initial"></span>
                    </div>
                </button>
                <div id="profile-dropdown" class="hidden absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-100 dark:bg-gray-800 dark:border-gray-700 overflow-hidden text-left z-50 origin-top-right">
                    <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                        <p id="dropdown-name" class="text-sm font-bold text-gray-900 dark:text-white truncate">User</p>
                        <p id="dropdown-email" class="text-xs text-gray-500 dark:text-gray-400 truncate">user@example.com</p>
                    </div>
                    <div class="py-1">
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
                    </div>
                </div>
            `;
            
            // Re-initialize logic from main.js if needed or manually attach here
            // Since main.js runs strictly on DOMContentLoaded, we need to manually re-attach listeners for this dynamic content
            const btn = document.getElementById('profile-menu-btn');
            const drop = document.getElementById('profile-dropdown');
            const logout = document.getElementById('logout-btn-dropdown');
            const settings = document.getElementById('settings-btn');
            
            btn.addEventListener('click', (e) => { e.stopPropagation(); drop.classList.toggle('hidden'); });
            document.addEventListener('click', (e) => {
                if (!drop.classList.contains('hidden') && !drop.contains(e.target) && !btn.contains(e.target)) drop.classList.add('hidden');
            });
            logout.addEventListener('click', async () => {
                await fetch('/api/logout', { method: 'POST' });
                window.location.href = '/app';
            });
            if (settings) {
                // Since Settings Logic is in history.js (oops, settings logic is actually in dashboard.js usually)
                // history.js doesn't have the Settings Modal logic! The Setting Modal is on dashboard.js. 
                // We should redirect to dashboard with ?settings=open or just link to dashboard.
                settings.addEventListener('click', () => {
                    window.location.href = '/app?settings=open'; 
                });
            }
        }

        if (window.updateProfileUI) {
            window.updateProfileUI(currentUser);
        }
    } else {
        // Show Login Button
        if (navRight) {
            navRight.innerHTML = `
                <a href="/app" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold text-sm shadow transition-colors">
                    Login / Dashboard
                </a>
            `;
        }
    }
}

// Logout (handled in updateUIForAuth now)
// logoutBtn.addEventListener... (removed)

// Navigation
prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
});

nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
});

async function fetchMonthlyData(year, month) {
    try {
        // Determine endpoint based on auth
        const endpoint = isAuthenticated 
            ? `/api/sessions/history?year=${year}&month=${month}`
            : `/api/public/history?year=${year}&month=${month}`;

        const res = await fetch(endpoint);
        if (!res.ok) throw new Error('Failed to fetch history');
        return await res.json();
    } catch (err) {
        console.error(err);
        return [];
    }
}

async function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); // 0-11

    currentMonthLabel.textContent = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Fetch data
    sessionsCache = await fetchMonthlyData(year, month + 1);

    // Render Monthly Topic Chart
    renderMonthlyTopicChart(sessionsCache);

    // Clear grid
    calendarGrid.innerHTML = '';
    dayDetails.classList.add('hidden');

    // Calculate days
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 (Sun) - 6 (Sat)
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Empty cells for previous month
    for (let i = 0; i < firstDayOfMonth; i++) {
        const cell = document.createElement('div');
        cell.className = 'bg-gray-50 min-h-[100px] p-2 dark:bg-gray-900'; // Dimmed
        calendarGrid.appendChild(cell);
    }

    // Days
    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div');
        cell.className = 'bg-white min-h-[100px] p-2 dark:bg-gray-800 cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700 transition';
        
        // Filter sessions for this day
        // Note: session.start is a timestamp
        const dayStart = new Date(year, month, day).getTime();
        const dayEnd = new Date(year, month, day, 23, 59, 59, 999).getTime();
        
        const daySessions = sessionsCache.filter(s => s.start >= dayStart && s.start <= dayEnd);
        const totalSeconds = daySessions.reduce((acc, s) => acc + (s.durationSeconds || (s.durationMinutes * 60) || 0), 0);
        
        // Cell Content
        const dateNum = document.createElement('div');
        dateNum.className = 'font-bold text-right text-sm mb-1';
        dateNum.textContent = day;
        
        // Highlight today
        const today = new Date();
        if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            dateNum.className += ' text-blue-600 dark:text-blue-400';
            cell.classList.add('border', 'border-blue-500');
        }

        cell.appendChild(dateNum);

        if (totalSeconds > 0) {
            const timeLabel = document.createElement('div');
            timeLabel.className = 'text-xs font-semibold text-green-600 dark:text-green-400';
            timeLabel.textContent = formatDurationShort(totalSeconds);
            cell.appendChild(timeLabel);

            // Optional: Dot indicators for sessions
            const dots = document.createElement('div');
            dots.className = 'flex gap-1 mt-1 flex-wrap';
            daySessions.slice(0, 5).forEach(() => {
                const dot = document.createElement('div');
                dot.className = 'w-1.5 h-1.5 rounded-full bg-blue-400';
                dots.appendChild(dot);
            });
            cell.appendChild(dots);
        }

        // Click Event
        cell.addEventListener('click', () => showDayDetails(day, daySessions, totalSeconds));

        calendarGrid.appendChild(cell);
    }
}

function showDayDetails(day, sessions, totalSeconds) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const dateStr = new Date(year, month, day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    selectedDateLabel.textContent = dateStr;
    dayTotalTimeEl.textContent = formatDurationExact(totalSeconds);
    
    daySessionListEl.innerHTML = '';
    if (sessions.length === 0) {
        daySessionListEl.innerHTML = '<li class="text-gray-500 italic">No study sessions recorded.</li>';
    } else {
        sessions.forEach(s => {
            const li = document.createElement('li');
            li.className = 'p-2 bg-gray-50 rounded border dark:bg-gray-700 dark:border-gray-600';
            
            const startTime = new Date(s.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const endTime = new Date(s.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dur = formatDurationExact(s.durationSeconds || (s.durationMinutes * 60));

            li.innerHTML = `
                <div class="flex justify-between items-start">
                    <span class="font-medium">${s.topicText || 'Unknown Topic'}</span>
                    <span class="text-sm font-bold text-blue-600 dark:text-blue-400">${dur}</span>
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    ${startTime} - ${endTime}
                </div>
            `;
            daySessionListEl.appendChild(li);
        });
    }

    dayDetails.classList.remove('hidden');
    dayDetails.scrollIntoView({ behavior: 'smooth' });
}

function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function formatDurationExact(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function formatDurationShort(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

let monthlyTopicChartInstance = null;

function renderMonthlyTopicChart(sessions) {
    const topicMap = {};
    sessions.forEach(s => {
        const topic = s.topicText || 'Untitled';
        const dur = s.durationSeconds || (s.durationMinutes * 60) || 0;
        topicMap[topic] = (topicMap[topic] || 0) + dur;
    });

    const sortedTopics = Object.entries(topicMap)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5); // Top 5

    const ctx = document.getElementById('monthlyTopicChart').getContext('2d');
    if (monthlyTopicChartInstance) monthlyTopicChartInstance.destroy();

    // Register plugin safely
    const plugins = [];
    if (typeof ChartDataLabels !== 'undefined') {
        plugins.push(ChartDataLabels);
    }

    monthlyTopicChartInstance = new Chart(ctx, {
        type: 'bar',
        plugins: plugins,
        data: {
            labels: sortedTopics.map(([topic]) => topic),
            datasets: [{
                label: 'Time Studied',
                data: sortedTopics.map(([,seconds]) => seconds),
                backgroundColor: 'rgba(153, 102, 255, 0.5)',
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    right: 50 // Space for labels
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        color: '#9ca3af',
                        callback: function(value) {
                            const h = Math.floor(value / 3600);
                            const m = Math.floor((value % 3600) / 60);
                            if (h > 0) return `${h}h ${m}m`;
                            return `${m}m`;
                        }
                    },
                    grid: {
                        color: 'rgba(107, 114, 128, 0.2)'
                    }
                },
                y: {
                    ticks: {
                        color: '#9ca3af',
                        autoSkip: false
                    },
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const seconds = context.raw;
                            const h = Math.floor(seconds / 3600);
                            const m = Math.floor((seconds % 3600) / 60);
                            const s = seconds % 60;
                            if (h > 0) return `Time: ${h}h ${m}m ${s}s`;
                            return `Time: ${m}m ${s}s`;
                        }
                    }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'end',
                    color: '#9ca3af',
                    font: {
                        weight: 'bold'
                    },
                    formatter: function(value, context) {
                        const h = Math.floor(value / 3600);
                        const m = Math.floor((value % 3600) / 60);
                        if (h > 0) return `${h}h ${m}m`;
                        return `${m}m`;
                    }
                }
            }
        }
    });
}

// Initial Load
// renderCalendar(); // Moved to checkAuth
