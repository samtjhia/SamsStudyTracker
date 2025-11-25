# Sam's Study Tracker

A full-stack web application designed to track study sessions, visualize progress, and send automated daily email reports. Built with Node.js, Express, PostgreSQL, and Vanilla JS.

## 🚀 Features

- **Real-time Study Timer**: Start, pause, and stop study sessions with topic tracking.
- **Visual Analytics**:
  - Weekly progress bar charts.
  - "Most Studied Topics" horizontal bar charts.
  - Detailed history calendar with daily breakdowns.
- **Automated Email Reports**:
  - Configurable daily email time.
  - Sends a summary of the day's sessions and total study time.
  - "Hype" or "Disappointment" messages based on whether the daily goal was met.
- **Public Dashboard**: A read-only view to share your progress with others.
- **Admin Panel**: Manage settings, view all sessions, and configure email preferences.
- **Dark Mode**: Fully supported UI with automatic theme detection.

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Frontend**: HTML5, Vanilla JavaScript, Tailwind CSS (via CDN)
- **Charting**: Chart.js (v4.4.0) with `chartjs-plugin-datalabels`
- **Authentication**: JWT (JSON Web Tokens) & bcrypt
- **Services**:
  - `node-cron`: For scheduling daily email checks.
  - `nodemailer`: For sending email reports via Gmail.

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [PostgreSQL](https://www.postgresql.org/)
- A Gmail account (for sending emails) with an [App Password](https://support.google.com/accounts/answer/185833).

## ⚙️ Installation & Setup

1.  **Clone the repository**
    ```bash
    git clone https://github.com/samtjhia/SamsStudyTracker.git
    cd SamsStudyTracker
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Configuration**
    Create a `.env` file in the root directory with the following variables:

    ```env
    # Server Configuration
    PORT=3000
    NODE_ENV=development

    # Database Connection
    DATABASE_URL=postgresql://user:password@localhost:5432/study_db

    # Security
    JWT_SECRET=your_super_secret_jwt_key
    SIGNUP_SECRET=your_secret_signup_code  # Required to create an account
    ALLOWED_EMAIL=your_email@example.com   # Grants admin/public dashboard access

    # Email Service (Gmail)
    EMAIL_USER=your_email@gmail.com
    EMAIL_PASS=your_gmail_app_password
    ```

4.  **Database Setup**
    The application will automatically create the necessary tables (`users`, `study_sessions`) upon the first run. Ensure your PostgreSQL server is running and the database specified in `DATABASE_URL` exists.

5.  **Run the Application**

    *   **Development** (with hot-reload):
        ```bash
        npm run dev
        ```
    *   **Production**:
        ```bash
        npm start
        ```

6.  **Access the App**
    Open `http://localhost:3000` in your browser.

## 🚀 Deployment (Render)

This project is configured for deployment on [Render](https://render.com/).

1.  Create a new **Web Service** on Render.
2.  Connect your GitHub repository.
3.  **Build Command**: `npm install`
4.  **Start Command**: `npm start`
5.  **Environment Variables**: Add all variables from your `.env` file (except `PORT`).
    *   For `DATABASE_URL`, use the Internal Connection URL from your Render Postgres database or your external provider (e.g., Supabase, Neon).

## 📂 Project Structure

```
├── public/             # Static frontend files
│   ├── css/
│   ├── js/             # Frontend logic (dashboard, history, charts)
│   ├── app.html        # Main dashboard
│   ├── history.html    # History view
│   └── index.html      # Landing/Public page
├── src/
│   ├── db/             # Database connection & schema
│   ├── middleware/     # Auth middleware
│   ├── routes/         # API endpoints
│   └── services/       # Email & Cron services
├── server.js           # Entry point
└── Dockerfile          # Docker configuration
```

## 📄 License

This project is open source and available under the [MIT License](LICENSE).