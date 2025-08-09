const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const Database = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database instance
let db;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Make database available to routes
app.use((req, res, next) => {
    req.db = db;
    next();
});

// Routes - load after middleware
const casesRouter = require('./routes/cases');
app.use('/api/cases', casesRouter);

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize database and start server
async function startServer() {
    try {
        db = new Database();
        await db.initialize();
        
        app.listen(PORT, () => {
            console.log(`Court Data Fetcher running on http://localhost:${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    if (db && db.db) {
        db.db.close((err) => {
            if (err) console.error('Error closing database:', err);
            else console.log('Database connection closed.');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

startServer();