const express = require('express');
const router = express.Router();
const CourtScraper = require('../services/courtScraper');

const scraper = new CourtScraper();

// Search for a case
router.post('/search', async (req, res) => {
    try {
        const { caseType, caseNumber, filingYear } = req.body;
        const db = req.db; // Get database from middleware

        // Validate input
        if (!caseType || !caseNumber || !filingYear) {
            return res.status(400).json({
                error: 'Missing required fields: caseType, caseNumber, filingYear'
            });
        }

        // Check if database is available
        if (!db) {
            return res.status(500).json({
                error: 'Database not available'
            });
        }

        // Log the query
        const queryId = await db.insertQuery(caseType, caseNumber, filingYear);

        try {
            // Search the case
            const caseData = await scraper.searchCase(caseType, caseNumber, filingYear);

            // Store case details
            await db.insertCaseDetails(queryId, caseData);
            await db.updateQueryStatus(queryId, 'success');

            res.json({
                success: true,
                data: caseData,
                queryId: queryId
            });

        } catch (scrapeError) {
            await db.updateQueryStatus(queryId, 'failed', scrapeError.message);
            
           if (scrapeError.message === 'CAPTCHA_REQUIRED') {
            res.status(400).json({
                error: 'CAPTCHA verification required',
                requiresCaptcha: true,
                queryId: queryId,
                captchaImage: scrapeError.captchaImage || null
            });
        }else if (scrapeError.message === 'CASE_NOT_FOUND') {
                res.status(404).json({
                    error: 'Case not found. Please check case type, number, and filing year.',
                    queryId: queryId
                });
            } else {
                res.status(500).json({
                    error: 'Failed to fetch case details. The court website might be down.',
                    details: scrapeError.message,
                    queryId: queryId
                });
            }
        }

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Handle CAPTCHA submission
router.post('/captcha', async (req, res) => {
    try {
        const { queryId, captchaText, caseType, caseNumber, filingYear } = req.body;
        const db = req.db;

        if (!queryId || !captchaText) {
            return res.status(400).json({
                error: 'Missing queryId or captchaText'
            });
        }

        // Solve CAPTCHA and retry the entire search
        const success = await scraper.solveCaptcha(captchaText);
        
        if (success) {
            try {
                // Try to extract case details after CAPTCHA submission
                const caseData = await scraper.extractCaseDetails();
                
                // Store case details
                await db.insertCaseDetails(queryId, caseData);
                await db.updateQueryStatus(queryId, 'success');

                res.json({
                    success: true,
                    data: caseData,
                    message: 'CAPTCHA solved and case details retrieved!'
                });

            } catch (extractError) {
                await db.updateQueryStatus(queryId, 'failed', `CAPTCHA solved but extraction failed: ${extractError.message}`);
                res.status(500).json({
                    error: 'CAPTCHA submitted but failed to extract case details',
                    details: extractError.message
                });
            }
        } else {
            await db.updateQueryStatus(queryId, 'failed', 'CAPTCHA submission failed');
            res.status(400).json({ 
                error: 'Failed to submit CAPTCHA. Please check the CAPTCHA text and try again.' 
            });
        }

    } catch (error) {
        console.error('CAPTCHA route error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get query history
router.get('/history', async (req, res) => {
    try {
        const db = req.db;
        
        if (!db) {
            return res.status(500).json({
                error: 'Database not available'
            });
        }
        
        const history = await db.getQueryHistory();
        res.json({ success: true, data: history });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Download PDF proxy
router.get('/download-pdf', async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({ error: 'PDF URL is required' });
        }

        // In a production environment, you'd want to validate the URL
        // and possibly cache/proxy the PDF through your server
        res.redirect(url);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;