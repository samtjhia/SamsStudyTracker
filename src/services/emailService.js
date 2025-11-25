const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendEmail = async (to, subject, html) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: to,
        subject: subject,
        html: html
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${to}`);
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

const generateEmailContent = (userName, dateStr, totalSeconds, targetMinutes, sessions) => {
    const totalMinutes = Math.round(totalSeconds / 60);
    const metTarget = totalMinutes >= targetMinutes;
    
    // Format total time
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const totalTimeStr = h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;

    const hypeMessage = metTarget 
        ? `${userName} crushed it today and hit his study goal! Congrats to bro 🔥` 
        : `${userName} missed their target today. Tell him how dissapointed you are and for him to lock in 😓`;
    
    const tableRows = sessions.map(s => {
        const startTime = new Date(s.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const endTime = new Date(s.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const durSec = s.durationSeconds || (s.durationMinutes * 60) || 0;
        const dh = Math.floor(durSec / 3600);
        const dm = Math.floor((durSec % 3600) / 60);
        const ds = durSec % 60;
        const durationStr = dh > 0 ? `${dh}h ${dm}m ${ds}s` : `${dm}m ${ds}s`;
        return `<tr>
            <td style="padding: 8px; border: 1px solid #ddd;">${startTime} - ${endTime}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${durationStr}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${s.topicText}</td>
        </tr>`;
    }).join('');

    // Chart Logic: Color by Topic
    const topics = [...new Set(sessions.map(s => s.topicText || 'Unknown'))];
    const palette = [
        'rgba(54, 162, 235, 0.7)',   // Blue
        'rgba(255, 99, 132, 0.7)',   // Red
        'rgba(255, 206, 86, 0.7)',   // Yellow
        'rgba(75, 192, 192, 0.7)',   // Green
        'rgba(153, 102, 255, 0.7)',  // Purple
        'rgba(255, 159, 64, 0.7)'    // Orange
    ];
    
    const topicColorMap = {};
    topics.forEach((topic, index) => {
        topicColorMap[topic] = palette[index % palette.length];
    });

    const chartLabels = sessions.map(s => new Date(s.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const chartData = sessions.map(s => Math.round((s.durationSeconds || (s.durationMinutes * 60)) / 60)); 
    const backgroundColors = sessions.map(s => topicColorMap[s.topicText || 'Unknown']);

    const chartConfig = {
        type: 'bar',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Minutes Studied',
                data: chartData,
                backgroundColor: backgroundColors,
                borderColor: backgroundColors.map(c => c.replace('0.7', '1.0')),
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                yAxes: [{
                    ticks: {
                        beginAtZero: true
                    }
                }]
            },
            legend: {
                display: false
            }
        }
    };
    
    const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}`;

    // Create Legend HTML
    const legendHtml = Object.keys(topicColorMap).map(topic => {
        const color = topicColorMap[topic];
        return `
            <div style="display: inline-flex; align-items: center; margin-right: 15px; margin-bottom: 5px;">
                <span style="width: 12px; height: 12px; background-color: ${color}; display: inline-block; margin-right: 5px; border: 1px solid #ccc;"></span>
                <span style="font-size: 0.9em;">${topic}</span>
            </div>
        `;
    }).join('');

    return `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>${userName}'s Study Report — ${dateStr}</h2>
            <p><strong>Total Time:</strong> ${totalTimeStr}</p>
            <p><strong>Target:</strong> ${targetMinutes} minutes (${metTarget ? 'MET ✅' : 'MISSED ❌'})</p>
            <p>${hypeMessage}</p>
            
            <h3>Session Breakdown</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f2f2f2;">
                        <th style="padding: 8px; border: 1px solid #ddd;">Time Range</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Duration</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Topic</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
            
            <h3>Daily Progress</h3>
            <img src="${chartUrl}" alt="Study Chart" style="width: 100%; max-width: 500px; margin-top: 20px;" />
            
            <div style="margin-top: 10px; display: flex; flex-wrap: wrap; justify-content: center;">
                ${legendHtml}
            </div>
            
            <p style="margin-top: 30px; font-size: 0.9em; color: #666;">Automated Accountability Report for ${userName}</p>
        </div>
    `;
};

module.exports = { sendEmail, generateEmailContent };
