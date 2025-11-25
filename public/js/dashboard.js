let timerInterval;
let startTime;
let elapsedTime = 0;
let isPaused = false;

const timerDisplay = document.getElementById('timer-display');
const startTimerBtn = document.getElementById('start-timer-btn');
const pauseTimerBtn = document.getElementById('pause-timer-btn');
const stopTimerBtn = document.getElementById('stop-timer-btn');
const studyTopicInput = document.getElementById('study-topic');

// Timer Logic
startTimerBtn.addEventListener('click', async () => {
    if (!studyTopicInput.value.trim()) {
        alert('Please enter what you are studying!');
        return;
    }

    startTimer();
    
    startTimerBtn.classList.add('hidden');
    pauseTimerBtn.classList.remove('hidden');
    stopTimerBtn.classList.remove('hidden');
    studyTopicInput.disabled = true;
    document.getElementById('is-private-session').disabled = true;

    // Notify server of live status
    await fetch('/api/session/live/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            start: Date.now(),
            topicText: studyTopicInput.value,
            isPrivate: document.getElementById('is-private-session').checked
        })
    });
});

pauseTimerBtn.addEventListener('click', async () => {
    if (isPaused) {
        // Resume
        startTimer();
        pauseTimerBtn.textContent = 'Pause';
        pauseTimerBtn.classList.remove('bg-green-500', 'hover:bg-green-600');
        pauseTimerBtn.classList.add('bg-yellow-500', 'hover:bg-yellow-600');
        isPaused = false;

        // Update server with new effective start time
        await fetch('/api/session/live/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                start: startTime, // startTimer() just updated this
                topicText: studyTopicInput.value,
                isPrivate: document.getElementById('is-private-session').checked
            })
        });

    } else {
        // Pause
        clearInterval(timerInterval);
        pauseTimerBtn.textContent = 'Resume';
        pauseTimerBtn.classList.remove('bg-yellow-500', 'hover:bg-yellow-600');
        pauseTimerBtn.classList.add('bg-green-500', 'hover:bg-green-600');
        isPaused = true;

        // Pause live session on server
        await fetch('/api/session/live/pause', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ duration: elapsedTime })
        });
    }
});

function startTimer() {
    startTime = Date.now() - elapsedTime;
    timerInterval = setInterval(() => {
        elapsedTime = Date.now() - startTime;
        updateTimerDisplay(elapsedTime);
    }, 1000);
}

stopTimerBtn.addEventListener('click', async () => {
    clearInterval(timerInterval);
    const endTime = Date.now();
    const durationSeconds = Math.round(elapsedTime / 1000);
    const isPrivate = document.getElementById('is-private-session').checked;
    
    const sessionData = {
        start: endTime - (durationSeconds * 1000),
        end: endTime,
        durationSeconds: durationSeconds,
        topicText: studyTopicInput.value,
        isPrivate: isPrivate
    };
    
    await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData)
    });

    // Clear live status
    await fetch('/api/session/live/stop', { method: 'POST' });

    // Reset UI
    elapsedTime = 0;
    isPaused = false;
    updateTimerDisplay(0);
    
    startTimerBtn.classList.remove('hidden');
    pauseTimerBtn.classList.add('hidden');
    stopTimerBtn.classList.add('hidden');
    
    // Reset Pause Button Style
    pauseTimerBtn.textContent = 'Pause';
    pauseTimerBtn.classList.remove('bg-green-500', 'hover:bg-green-600');
    pauseTimerBtn.classList.add('bg-yellow-500', 'hover:bg-yellow-600');

    studyTopicInput.disabled = false;
    studyTopicInput.value = '';
    document.getElementById('is-private-session').disabled = false;
    document.getElementById('is-private-session').checked = false;

    loadDashboardData();
});

function updateTimerDisplay(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    timerDisplay.textContent = 
        `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function pad(num) {
    return num.toString().padStart(2, '0');
}

// Dashboard Data Loading
window.loadDashboardData = async () => {
    await loadStats();
    await loadSessions();
    await checkLiveSession();
};

async function checkLiveSession() {
    try {
        const res = await fetch('/api/session/live');
        if (!res.ok) return;
        
        const session = await res.json();
        if (session) {
            // Restore Session State
            studyTopicInput.value = session.topic;
            studyTopicInput.disabled = true;
            document.getElementById('is-private-session').checked = session.isPrivate;
            document.getElementById('is-private-session').disabled = true;

            startTimerBtn.classList.add('hidden');
            pauseTimerBtn.classList.remove('hidden');
            stopTimerBtn.classList.remove('hidden');

            if (session.isPaused) {
                isPaused = true;
                elapsedTime = session.pausedDuration; // Server stores ms, we need ms
                startTime = null; // Not running
                
                updateTimerDisplay(elapsedTime);
                
                pauseTimerBtn.textContent = 'Resume';
                pauseTimerBtn.classList.remove('bg-yellow-500', 'hover:bg-yellow-600');
                pauseTimerBtn.classList.add('bg-green-500', 'hover:bg-green-600');
            } else {
                // Running
                startTime = session.start;
                elapsedTime = Date.now() - startTime;
                
                timerInterval = setInterval(() => {
                    elapsedTime = Date.now() - startTime;
                    updateTimerDisplay(elapsedTime);
                }, 1000);
                updateTimerDisplay(elapsedTime);
            }
        }
    } catch (err) {
        console.error('Error checking live session:', err);
    }
}

async function loadStats() {
    // Load Stats
    const statsRes = await fetch('/api/stats/today');
    const stats = await statsRes.json();
    
    // Format total time nicely
    const totalSeconds = stats.totalSeconds || 0;
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    
    document.getElementById('stat-total-time').textContent = `${h}h ${m}m ${s}s`;
    document.getElementById('stat-session-count').textContent = stats.sessionCount;
}

async function loadSessions() {
    // Load Sessions
    const sessionsRes = await fetch('/api/sessions/today');
    const sessions = await sessionsRes.json();
    const sessionList = document.getElementById('session-list');
    sessionList.innerHTML = '';

    // Check delete mode
    const deleteMode = document.getElementById('admin-delete-mode').checked;

    if (sessions.length === 0) {
        sessionList.innerHTML = '<li class="text-gray-500 text-center italic">No sessions yet today.</li>';
    } else {
        sessions.forEach(session => {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center bg-gray-50 p-3 rounded border dark:bg-gray-700 dark:border-gray-600';
            const startTime = new Date(session.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const endTime = new Date(session.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // Calculate duration display
            const durSec = session.durationSeconds || (session.durationMinutes * 60) || 0;
            const dh = Math.floor(durSec / 3600);
            const dm = Math.floor((durSec % 3600) / 60);
            const ds = durSec % 60;
            const durationStr = dh > 0 ? `${dh}h ${dm}m ${ds}s` : `${dm}m ${ds}s`;

            let deleteBtn = '';
            if (deleteMode) {
                deleteBtn = `<button class="ml-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-bold" onclick="deleteSession(${session.id})">X</button>`;
            }

            li.innerHTML = `
                <div class="flex-1">
                    <input type="text" value="${session.topicText}" 
                        class="font-bold text-gray-700 dark:text-gray-200 bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-500 focus:border-blue-500 focus:outline-none w-full"
                        onchange="updateSessionTopic(${session.id}, this.value)">
                    <span class="text-xs text-gray-500 dark:text-gray-400 block">${startTime} - ${endTime}</span>
                </div>
                <div class="flex items-center">
                    <div class="flex items-center mr-4" title="Private Session">
                        <input type="checkbox" ${session.isPrivate ? 'checked' : ''} 
                            onchange="updateSessionPrivacy(${session.id}, this.checked)"
                            class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600">
                        <span class="ml-1 text-xs text-gray-400">🔒</span>
                    </div>
                    <span class="font-mono font-bold text-blue-600 dark:text-blue-400 ml-4">${durationStr}</span>
                    ${deleteBtn}
                </div>
            `;
            sessionList.appendChild(li);
        });
    }
    
    loadCharts();
};

let dailyChartInstance = null;
let weeklyChartInstance = null;

async function loadCharts() {
    // Daily Chart (Today's sessions by topic)
    const sessionsRes = await fetch('/api/sessions/today');
    const sessions = await sessionsRes.json();
    
    const topicMap = {};
    sessions.forEach(s => {
        const topic = s.topicText || 'Unknown';
        const dur = (s.durationSeconds || (s.durationMinutes * 60)) / 60; // minutes
        topicMap[topic] = (topicMap[topic] || 0) + dur;
    });

    const dailyCtx = document.getElementById('dailyChart').getContext('2d');
    if (dailyChartInstance) dailyChartInstance.destroy();
    
    dailyChartInstance = new Chart(dailyCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(topicMap),
            datasets: [{
                data: Object.values(topicMap),
                backgroundColor: [
                    'rgba(255, 99, 132, 0.7)',
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(255, 206, 86, 0.7)',
                    'rgba(75, 192, 192, 0.7)',
                    'rgba(153, 102, 255, 0.7)',
                    'rgba(255, 159, 64, 0.7)'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                }
            }
        }
    });

    // Weekly Chart
    const weeklyRes = await fetch('/api/stats/weekly');
    const weeklyResponse = await weeklyRes.json();
    
    // Handle both old format (just dailyTotals) and new format ({ dailyTotals, topicBreakdown })
    const weeklyData = weeklyResponse.dailyTotals || weeklyResponse;
    const weeklyTopicData = weeklyResponse.topicBreakdown || {};

    const weeklyCtx = document.getElementById('weeklyChart').getContext('2d');
    if (weeklyChartInstance) weeklyChartInstance.destroy();

    // Convert YYYY-MM-DD to Day Name
    const labels = Object.keys(weeklyData).map(dateStr => {
        // Append T00:00:00 to force local time parsing so Monday stays Monday
        const date = new Date(dateStr + 'T00:00:00'); 
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    });
    
    // Use seconds for precision
    const dataPoints = Object.values(weeklyData);

    weeklyChartInstance = new Chart(weeklyCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Time Studied',
                data: dataPoints,
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            const h = Math.floor(value / 3600);
                            const m = Math.floor((value % 3600) / 60);
                            if (h > 0) return `${h}h ${m}m`;
                            return `${m}m`;
                        }
                    }
                }
            },
            plugins: {
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
                }
            }
        }
    });

    // Weekly Topic Chart (Horizontal Bar)
    const weeklyTopicCtx = document.getElementById('weeklyTopicChart').getContext('2d');
    if (window.weeklyTopicChartInstance) window.weeklyTopicChartInstance.destroy();

    // Sort topics by duration
    const sortedTopics = Object.entries(weeklyTopicData)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5); // Top 5

    // Register plugin safely
    const plugins = [];
    if (typeof ChartDataLabels !== 'undefined') {
        plugins.push(ChartDataLabels);
    }

    window.weeklyTopicChartInstance = new Chart(weeklyTopicCtx, {
        type: 'bar',
        plugins: plugins,
        data: {
            labels: sortedTopics.map(([topic]) => topic),
            datasets: [{
                label: 'Time Studied',
                data: sortedTopics.map(([,seconds]) => seconds),
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            layout: {
                padding: {
                    right: 50 // Space for labels
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        color: '#9ca3af', // gray-400
                        callback: function(value) {
                            const h = Math.floor(value / 3600);
                            const m = Math.floor((value % 3600) / 60);
                            if (h > 0) return `${h}h ${m}m`;
                            return `${m}m`;
                        }
                    },
                    grid: {
                        color: 'rgba(107, 114, 128, 0.2)' // gray-500 low opacity
                    }
                },
                y: {
                    ticks: {
                        color: '#9ca3af', // gray-400
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
                    color: '#9ca3af', // gray-400
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

window.deleteSession = async (id) => {
    if (!confirm('Delete this session?')) return;
    await fetch(`/api/session/${id}`, { method: 'DELETE' });
    loadDashboardData();
};

window.updateSessionTopic = async (id, newTopic) => {
    await fetch(`/api/session/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicText: newTopic })
    });
};

window.updateSessionPrivacy = async (id, isPrivate) => {
    await fetch(`/api/session/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPrivate })
    });
};

// Admin Logic
async function checkAdmin() {
    const res = await fetch('/api/me');
    const data = await res.json();
    if (data.isAdmin) {
        document.getElementById('admin-section').classList.remove('hidden');
        loadAdminUsers();
    }
}

async function loadAdminUsers() {
    const res = await fetch('/api/admin/users');
    if (!res.ok) return;
    
    const users = await res.json();
    const list = document.getElementById('admin-user-list');
    list.innerHTML = '';

    users.forEach(user => {
        const li = document.createElement('li');
        li.className = 'bg-red-50 p-3 rounded border border-red-100 dark:bg-red-900 dark:border-red-800';
        
        // Get today's date in YYYY-MM-DD format (local time)
        const today = new Date().toLocaleDateString('en-CA');

        let emailsHtml = '<div class="mt-2 pl-4 border-l-2 border-red-200 dark:border-red-700">';
        if (user.accountabilityEmails && user.accountabilityEmails.length > 0) {
            user.accountabilityEmails.forEach(email => {
                const isSentToday = email.lastSentDate === today;
                const status = isSentToday ? 
                    `<span class="text-green-600 dark:text-green-400 font-bold">Sent Today</span>` : 
                    `<span class="text-yellow-600 dark:text-yellow-400">Not sent today ${email.lastSentDate ? `(Last: ${email.lastSentDate})` : ''}</span>`;
                
                emailsHtml += `
                    <div class="flex justify-between items-center text-xs mb-1">
                        <span class="text-gray-600 dark:text-gray-300">${email.email}</span>
                        <div class="flex items-center space-x-2">
                            ${status}
                            <button class="text-blue-500 hover:text-blue-700 underline" onclick="resetEmail(${email.id})">Reset</button>
                        </div>
                    </div>
                `;
            });
        } else {
            emailsHtml += '<span class="text-xs text-gray-400 italic">No accountability emails</span>';
        }
        emailsHtml += '</div>';

        li.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <span class="font-bold text-gray-700 dark:text-gray-200 block">${user.email}</span>
                    <span class="text-xs text-gray-500 dark:text-gray-400">ID: ${user.id} | Target: ${user.dailyTargetMin}m</span>
                </div>
                <div class="space-x-1">
                    <button class="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 text-xs font-bold border border-purple-200 dark:border-purple-700 px-2 py-1 rounded bg-white dark:bg-gray-800" 
                        onclick="triggerReport(${user.id})">Send Now</button>
                    <button class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-xs font-bold border border-red-200 dark:border-red-700 px-2 py-1 rounded bg-white dark:bg-gray-800" 
                        onclick="deleteUser(${user.id}, '${user.email}')">Delete User</button>
                </div>
            </div>
            ${emailsHtml}
        `;
        list.appendChild(li);
    });
}

window.triggerReport = async (id) => {
    if (!confirm('Force send report now? This will attempt to send emails to all recipients who haven\'t received one today.')) return;
    
    const res = await fetch(`/api/admin/users/${id}/trigger-report`, { method: 'POST' });
    const data = await res.json();
    alert(data.message);
    loadAdminUsers();
};

window.resetEmail = async (id) => {
    if (!confirm('Reset status for this email? It will be sent again on next cron run.')) return;
    
    const res = await fetch(`/api/admin/emails/${id}/reset`, { method: 'POST' });
    const data = await res.json();
    
    if (res.ok) {
        alert(data.message);
        loadAdminUsers();
    } else {
        alert(data.error);
    }
};

window.deleteUser = async (id, email) => {
    if (!confirm(`Are you sure you want to DELETE user ${email}? This will wipe all their data forever.`)) return;

    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    const data = await res.json();
    
    if (res.ok) {
        alert(data.message);
        loadAdminUsers();
    } else {
        alert(data.error);
    }
};

// Settings Logic
const settingsModal = document.getElementById('settings-modal');
const settingsBtn = document.getElementById('settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const addEmailBtn = document.getElementById('add-email-btn');
const newEmailInput = document.getElementById('new-email-input');
const emailList = document.getElementById('email-list');

settingsBtn.addEventListener('click', async () => {
    const res = await fetch('/api/settings');
    const data = await res.json();
    
    document.getElementById('setting-target').value = data.dailyTargetMin;
    document.getElementById('setting-username').value = data.username || '';
    
    // Handle legacy dailyEmailHour or new dailyEmailTime
    if (data.dailyEmailTime) {
        document.getElementById('setting-time').value = data.dailyEmailTime;
    } else {
        // Fallback for old data: convert hour to HH:00
        const hour = data.dailyEmailHour || 20;
        document.getElementById('setting-time').value = `${hour.toString().padStart(2, '0')}:00`;
    }
    
    renderEmailList(data.accountabilityEmails);
    settingsModal.classList.remove('hidden');
    
    // Check admin status when opening settings
    checkAdmin();
});

// Listen for delete mode toggle
document.getElementById('admin-delete-mode').addEventListener('change', () => {
    loadDashboardData();
});

closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
});

saveSettingsBtn.addEventListener('click', async () => {
    const dailyTargetMin = document.getElementById('setting-target').value;
    const dailyEmailTime = document.getElementById('setting-time').value;
    const username = document.getElementById('setting-username').value;

    await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyTargetMin, dailyEmailTime, username })
    });

    settingsModal.classList.add('hidden');
});

addEmailBtn.addEventListener('click', async () => {
    const email = newEmailInput.value;
    if (!email) return;

    const res = await fetch('/api/emails/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });

    if (res.ok) {
        newEmailInput.value = '';
        // Refresh list
        const settingsRes = await fetch('/api/settings');
        const data = await settingsRes.json();
        renderEmailList(data.accountabilityEmails);
    } else {
        const data = await res.json();
        alert(data.error || 'Failed to add email');
    }
});

function renderEmailList(emails) {
    emailList.innerHTML = '';
    emails.forEach(email => {
        const li = document.createElement('li');
        li.className = 'flex justify-between items-center bg-gray-100 p-2 rounded dark:bg-gray-700 dark:text-white';
        li.innerHTML = `
            <span class="text-sm">${email}</span>
            <button class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs delete-email-btn" data-email="${email}">Remove</button>
        `;
        emailList.appendChild(li);
    });

    document.querySelectorAll('.delete-email-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const email = e.target.dataset.email;
            await fetch('/api/emails/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            // Refresh list
            const settingsRes = await fetch('/api/settings');
            const data = await settingsRes.json();
            renderEmailList(data.accountabilityEmails);
        });
    });
}
