const liveStatusContainer = document.getElementById('live-status-container');
const liveTopicEl = document.getElementById('live-topic');
const liveTimerEl = document.getElementById('live-timer');
const statTotalTimeEl = document.getElementById('stat-total-time');
const statSessionCountEl = document.getElementById('stat-session-count');
const sessionListEl = document.getElementById('session-list');
const publicStatusImage = document.getElementById('public-status-image');

let liveTimerInterval;
let dailyChartInstance;
let weeklyChartInstance;

async function loadPublicData() {
    try {
        const res = await fetch(`/api/public/dashboard?_=${Date.now()}`);
        if (!res.ok) throw new Error('Failed to load data');
        const data = await res.json();

        // 1. Update Stats
        const totalSeconds = data.stats.totalSeconds;
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        statTotalTimeEl.textContent = `${h}h ${m}m ${s}s`;
        statSessionCountEl.textContent = data.stats.sessionCount;

        // 2. Update Session List
        sessionListEl.innerHTML = '';
        if (data.sessions.length === 0) {
            sessionListEl.innerHTML = '<li class="text-gray-500 text-center italic">No sessions yet today.</li>';
        } else {
            data.sessions.forEach(session => {
                const li = document.createElement('li');
                li.className = 'flex justify-between items-center p-2 border-b last:border-0 dark:border-gray-700';
                
                const startTime = new Date(session.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const endTime = new Date(session.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const duration = formatDuration(session.durationSeconds);

                li.innerHTML = `
                    <div>
                        <span class="font-medium block">${session.topicText}</span>
                        <span class="text-xs text-gray-500 dark:text-gray-400">${startTime} - ${endTime}</span>
                    </div>
                    <span class="font-bold text-blue-600 dark:text-blue-400">${duration}</span>
                `;
                sessionListEl.appendChild(li);
            });
        }

        // 3. Update Live Status
        const liveStatusHeader = liveStatusContainer.querySelector('h2');
        liveStatusContainer.classList.remove('hidden');

        if (data.liveStatus && data.liveStatus.start) {
            publicStatusImage.src = '/images/piratewriting.png';
            liveStatusHeader.textContent = '● LIVE NOW';
            liveStatusHeader.classList.remove('text-gray-500');
            liveStatusHeader.classList.add('text-green-500', 'animate-pulse');

            liveTopicEl.textContent = data.liveStatus.topic;
            liveTopicEl.classList.remove('text-gray-500', 'italic');
            
            // Start local timer based on server start time
            if (liveTimerInterval) clearInterval(liveTimerInterval);
            
            const startTimestamp = Number(data.liveStatus.start);
            
            const updateTimer = () => {
                let totalSeconds;
                
                if (data.liveStatus.isPaused && data.liveStatus.pausedDuration != null) {
                     // Use the frozen duration from server
                     totalSeconds = Math.floor(data.liveStatus.pausedDuration / 1000);
                } else {
                     const now = Date.now();
                     const elapsed = Math.max(0, now - startTimestamp);
                     totalSeconds = Math.floor(elapsed / 1000);
                }

                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                
                if (data.liveStatus.isPaused) {
                    liveTimerEl.textContent = `${pad(hours)}:${pad(minutes)}:${pad(seconds)} (Paused)`;
                    liveTimerEl.classList.add('text-yellow-500');
                } else {
                    liveTimerEl.textContent = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
                    liveTimerEl.classList.remove('text-yellow-500');
                }
            };

            updateTimer(); // Initial call
            
            // Only tick if not paused
            if (!data.liveStatus.isPaused) {
                liveTimerInterval = setInterval(updateTimer, 1000);
            }

        } else {
            if (liveTimerInterval) clearInterval(liveTimerInterval);

            publicStatusImage.src = '/images/snorlax.png';
            liveStatusHeader.textContent = 'OFFLINE';
            liveStatusHeader.classList.remove('text-green-500', 'animate-pulse');
            liveStatusHeader.classList.add('text-gray-500');

            liveTopicEl.textContent = 'Not currently studying';
            liveTopicEl.classList.add('text-gray-500', 'italic');
            
            liveTimerEl.textContent = '--:--:--';
            liveTimerEl.classList.remove('text-yellow-500');
        }

        // 4. Render Charts
        renderCharts(data.dailyBreakdown, data.weeklyProgress, data.weeklyTopicBreakdown);

    } catch (err) {
        console.error(err);
    }
}

function renderCharts(dailyData, weeklyData, weeklyTopicData) {
    // Daily Pie Chart
    const dailyCtx = document.getElementById('dailyChart').getContext('2d');
    
    // Use seconds directly for precision
    const dailyLabels = Object.keys(dailyData);
    const dailyValues = Object.values(dailyData);
    const dailyColors = dailyLabels.map((label, i) => {
        if (label.includes('Private Session')) return 'rgba(107, 114, 128, 0.8)'; // Gray
        const colors = [
            'rgba(255, 99, 132, 0.7)',
            'rgba(54, 162, 235, 0.7)',
            'rgba(255, 206, 86, 0.7)',
            'rgba(75, 192, 192, 0.7)',
            'rgba(153, 102, 255, 0.7)',
            'rgba(255, 159, 64, 0.7)'
        ];
        return colors[i % colors.length];
    });

    if (dailyChartInstance) {
        dailyChartInstance.data.labels = dailyLabels;
        dailyChartInstance.data.datasets[0].data = dailyValues;
        dailyChartInstance.data.datasets[0].backgroundColor = dailyColors;
        dailyChartInstance.update('none');
    } else {
        dailyChartInstance = new Chart(dailyCtx, {
            type: 'doughnut',
            data: {
                labels: dailyLabels,
                datasets: [{
                    data: dailyValues,
                    backgroundColor: dailyColors
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom' },
                    title: { display: true, text: 'Time by Topic' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw;
                                return `${label}: ${formatDuration(value)}`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Weekly Bar Chart
    const weeklyCtx = document.getElementById('weeklyChart').getContext('2d');

    const weeklyLabels = Object.keys(weeklyData).map(dateStr => {
        const date = new Date(dateStr + 'T00:00:00'); 
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    });
    
    const weeklyValues = Object.values(weeklyData);

    if (weeklyChartInstance) {
        weeklyChartInstance.data.labels = weeklyLabels;
        weeklyChartInstance.data.datasets[0].data = weeklyValues;
        weeklyChartInstance.update('none');
    } else {
        weeklyChartInstance = new Chart(weeklyCtx, {
            type: 'bar',
            data: {
                labels: weeklyLabels,
                datasets: [{
                    label: 'Time Studied',
                    data: weeklyValues,
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
                                return `Time: ${formatDuration(context.raw)}`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Weekly Topic Chart (Horizontal Bar)
    const weeklyTopicCtx = document.getElementById('weeklyTopicChart').getContext('2d');
    
    // Sort topics by duration
    const sortedTopics = Object.entries(weeklyTopicData || {})
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5); // Top 5

    const topicLabels = sortedTopics.map(([topic]) => topic);
    const topicValues = sortedTopics.map(([,seconds]) => seconds);

    // Register plugin safely
    const plugins = [];
    if (typeof ChartDataLabels !== 'undefined') {
        plugins.push(ChartDataLabels);
    }

    if (window.weeklyTopicChartInstance) {
        window.weeklyTopicChartInstance.data.labels = topicLabels;
        window.weeklyTopicChartInstance.data.datasets[0].data = topicValues;
        window.weeklyTopicChartInstance.update('none');
    } else {
        window.weeklyTopicChartInstance = new Chart(weeklyTopicCtx, {
            type: 'bar',
            plugins: plugins,
            data: {
                labels: topicLabels,
                datasets: [{
                    label: 'Time Studied',
                    data: topicValues,
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
                                return `Time: ${formatDuration(context.raw)}`;
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
}

function pad(num) {
    return num.toString().padStart(2, '0');
}

function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
}

// Poll for updates every 5 seconds
setInterval(loadPublicData, 5000);

// Initial Load
loadPublicData();
loadPublicData();
setInterval(loadPublicData, 5000);
