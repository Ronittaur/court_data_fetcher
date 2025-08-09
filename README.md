# Court Data Fetcher & Mini Dashboard

## Overview
This is a small Node.js web application that lets users search for case details from a specific Indian court website.  
For this implementation, I have targeted **[Delhi High Court](https://delhihighcourt.nic.in/)** (can be switched to any other court portal with minimal changes).

The app provides a simple form where the user can select:
- Case Type
- Case Number
- Filing Year  

On submission, the app fetches the details from the court’s public portal, processes them, and displays:
- Parties’ names
- Filing date and next hearing date
- Latest order/judgment PDF link

It also stores query logs and raw HTML responses in the database for reference.

---

## Features
- Clean and minimal web UI
- Real-time data scraping from the court site
- SQLite database logging for each search
- Error handling for invalid cases or downtime
- PDF link download for the latest order/judgment

---

## Tech Stack
- **Backend:** Node.js + Express
- **Database:** SQLite (via `sqlite3` package)
- **Web Scraping:** Puppeteer
- **Frontend:** HTML/CSS (lightweight static templates)
- **Environment Management:** dotenv

---

## Setup & Installation
### 
1. Clone the repository```bash
git clone https://github.com/<your-username>/court_data_fetcher.git
cd court_data_fetcher
2. Install dependencies
bash
Copy code
npm install
3. Environment variables
Create a .env file in the root directory (see .env.example for reference):
ini
Copy code
PORT=5000
DATABASE_URL=sqlite:./database/court_data.db
COURT_URL=https://delhihighcourt.nic.in/

4. Run the app
bash
Copy code
node server.js
The app will be available at: arduino

Copy code
http://localhost:5000

CAPTCHA Handling Strategy
In this version, the app bypasses basic anti-bot measures using Puppeteer automation.
If the court site enforces a CAPTCHA, the approach can be:
Manual entry field (user solves CAPTCHA in the form)
Third-party CAPTCHA solving API (documented in README)

Database
Type: SQLite
Purpose: Store user queries and raw responses
Schema: logs table with case details, timestamp, and raw HTML
