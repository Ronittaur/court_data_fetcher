const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

class Database {
    constructor() {
        this.dbPath = process.env.DB_PATH || './database/court_data.db';
        this.db = null;
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            // Create database directory if it doesn't exist
            const fs = require('fs');
            const dbDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
                if (err) {
                    console.error('Database connection error:', err);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTables() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const queries = `
                CREATE TABLE IF NOT EXISTS queries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    case_type TEXT NOT NULL,
                    case_number TEXT NOT NULL,
                    filing_year INTEGER NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    status TEXT DEFAULT 'pending',
                    raw_response TEXT,
                    error_message TEXT
                );

                CREATE TABLE IF NOT EXISTS case_details (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    query_id INTEGER,
                    case_title TEXT,
                    parties TEXT,
                    filing_date TEXT,
                    next_hearing_date TEXT,
                    judge_name TEXT,
                    orders_json TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (query_id) REFERENCES queries (id)
                );

                CREATE TABLE IF NOT EXISTS pdf_links (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    case_detail_id INTEGER,
                    pdf_url TEXT,
                    pdf_type TEXT,
                    date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (case_detail_id) REFERENCES case_details (id)
                );
            `;

            this.db.exec(queries, (err) => {
                if (err) {
                    console.error('Error creating tables:', err);
                    reject(err);
                } else {
                    console.log('Database tables created successfully');
                    resolve();
                }
            });
        });
    }

    async insertQuery(caseType, caseNumber, filingYear) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const query = `INSERT INTO queries (case_type, case_number, filing_year) VALUES (?, ?, ?)`;
            this.db.run(query, [caseType, caseNumber, filingYear], function(err) {
                if (err) {
                    console.error('Error inserting query:', err);
                    reject(err);
                } else {
                    console.log('Query inserted with ID:', this.lastID);
                    resolve(this.lastID);
                }
            });
        });
    }

    async updateQueryStatus(queryId, status, errorMessage = null) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const query = `UPDATE queries SET status = ?, error_message = ? WHERE id = ?`;
            this.db.run(query, [status, errorMessage, queryId], function(err) {
                if (err) {
                    console.error('Error updating query status:', err);
                    reject(err);
                } else {
                    console.log('Query status updated for ID:', queryId);
                    resolve();
                }
            });
        });
    }

    async insertCaseDetails(queryId, caseData) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const query = `INSERT INTO case_details 
                (query_id, case_title, parties, filing_date, next_hearing_date, judge_name, orders_json) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`;
            
            this.db.run(query, [
                queryId,
                caseData.title || 'N/A',
                caseData.parties || 'N/A',
                caseData.filingDate || 'N/A',
                caseData.nextHearingDate || 'N/A',
                caseData.judgeName || 'N/A',
                JSON.stringify(caseData.orders || [])
            ], function(err) {
                if (err) {
                    console.error('Error inserting case details:', err);
                    reject(err);
                } else {
                    console.log('Case details inserted with ID:', this.lastID);
                    resolve(this.lastID);
                }
            });
        });
    }

    async getQueryHistory(limit = 50) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const query = `
                SELECT q.*, cd.case_title, cd.parties, cd.filing_date 
                FROM queries q 
                LEFT JOIN case_details cd ON q.id = cd.query_id 
                ORDER BY q.timestamp DESC 
                LIMIT ?
            `;
            this.db.all(query, [limit], (err, rows) => {
                if (err) {
                    console.error('Error fetching query history:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Test database connection
    async testConnection() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            this.db.get("SELECT 1 as test", (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }
}

module.exports = Database;