const puppeteer = require('puppeteer');

class CourtScraper {
    constructor() {
        this.baseUrl = 'https://hcservices.ecourts.gov.in';
        this.browser = null;
        this.page = null;
    }

    async initialize() {
        this.browser = await puppeteer.launch({
            headless: process.env.PUPPETEER_HEADLESS === 'true',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.page = await this.browser.newPage();
        
        // Set user agent to avoid detection
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        // Set viewport
        await this.page.setViewport({ width: 1366, height: 768 });
        
        console.log('Court scraper initialized');
    }

    async searchCase(caseType, caseNumber, filingYear) {
        try {
            if (!this.page) {
                await this.initialize();
            }

 // Navigate to case status page - try multiple URLs
const possibleUrls = [
    `${this.baseUrl}/hcservices/`,
    `${this.baseUrl}/`,
    'https://delhihighcourt.nic.in/dhccase/case_status.php',
    'https://districts.ecourts.gov.in/delhi-new-delhi/case_status_public'
];

let pageLoaded = false;
for (const url of possibleUrls) {
    try {
        console.log(`Trying URL: ${url}`);
        await this.page.goto(url, { 
            waitUntil: 'networkidle0',
            timeout: 15000 
        });
        
        // Check if page has case search form
        const hasForm = await this.page.$('form') !== null;
        if (hasForm) {
            console.log(`Found form at: ${url}`);
            pageLoaded = true;
            break;
        }
    } catch (error) {
        console.log(`Failed to load: ${url}`);
        continue;
    }
}

if (!pageLoaded) {
    throw new Error('SITE_UNAVAILABLE');
}

// Wait for any form elements to load (more flexible selectors)
const formSelectors = ['#case_type', 'select[name="case_type"]', 'input[name="case_number"]', 'form select', 'form input'];
let formFound = false;

for (const selector of formSelectors) {
    try {
        await this.page.waitForSelector(selector, { timeout: 3000 });
        console.log(`Found form element: ${selector}`);
        formFound = true;
        break;
    } catch (error) {
        continue;
    }
}

if (!formFound) {
    // Take a screenshot for debugging
    await this.page.screenshot({ path: 'debug-page.png', fullPage: true });
    throw new Error('FORM_NOT_FOUND');
}

           // Fill the form with flexible selectors
try {
    // Try different selector patterns for case type
    const caseTypeSelectors = ['#case_type', 'select[name="case_type"]', 'select[name="casetype"]'];
    for (const selector of caseTypeSelectors) {
        const element = await this.page.$(selector);
        if (element) {
            await this.page.select(selector, caseType);
            console.log(`Selected case type using: ${selector}`);
            break;
        }
    }
    
    // Try different selector patterns for case number
    const caseNumberSelectors = ['#case_number', 'input[name="case_number"]', 'input[name="casenumber"]'];
    for (const selector of caseNumberSelectors) {
        const element = await this.page.$(selector);
        if (element) {
            await this.page.type(selector, caseNumber);
            console.log(`Entered case number using: ${selector}`);
            break;
        }
    }
    
        // Try different selector patterns for filing year
        const yearSelectors = ['#filing_year', 'select[name="filing_year"]', 'select[name="year"]'];
        for (const selector of yearSelectors) {
            const element = await this.page.$(selector);
            if (element) {
                await this.page.select(selector, filingYear.toString());
                console.log(`Selected year using: ${selector}`);
                break;
                }
            }
        
            } catch (formError) {
                console.error('Form filling error:', formError);
                throw new Error('FORM_FILL_FAILED');
            }

            // Check for CAPTCHA and capture image
        const captchaSelectors = ['#captcha_image', '.captcha-image', 'img[src*="captcha"]', 'img[alt*="captcha"]'];
        let captchaImageBase64 = null;

        for (const selector of captchaSelectors) {
            const captchaImg = await this.page.$(selector);
            if (captchaImg) {
                try {
                    const screenshot = await captchaImg.screenshot();
                    captchaImageBase64 = screenshot.toString('base64');
                    console.log('CAPTCHA image captured');
                    break;
                } catch (error) {
                    console.error('Error capturing CAPTCHA:', error);
                }
            }
        }

        if (captchaImageBase64) {
            const error = new Error('CAPTCHA_REQUIRED');
            error.captchaImage = captchaImageBase64;
            throw error;
        }

            // Submit the form with flexible selectors
        const submitSelectors = [
            '#search_button', 
            'input[type="submit"]', 
            'button[type="submit"]',
            '.submit-btn',
            '.search-btn'
        ];

        let submitted = false;
        for (const selector of submitSelectors) {
            const element = await this.page.$(selector);
            if (element) {
                await this.page.click(selector);
                console.log(`Clicked submit using: ${selector}`);
                submitted = true;
                break;
            }
        }

        if (!submitted) {
            throw new Error('SUBMIT_BUTTON_NOT_FOUND');
        }

            // Wait for results
            await this.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });

            // Check if case found
            const noResultsText = await this.page.$eval('body', el => el.textContent);
            if (noResultsText.includes('No records found') || noResultsText.includes('Case not found')) {
                throw new Error('CASE_NOT_FOUND');
            }

            // Extract case details
            const caseData = await this.extractCaseDetails();
            return caseData;

        } catch (error) {
            console.error('Scraping error:', error.message);
            throw error;
        }
    }

    async extractCaseDetails() {
        try {
            const caseData = await this.page.evaluate(() => {
                // This is a generic extraction - you'll need to customize based on actual HTML structure
                const extractText = (selector) => {
                    const element = document.querySelector(selector);
                    return element ? element.textContent.trim() : '';
                };

                const extractAllText = (selector) => {
                    const elements = document.querySelectorAll(selector);
                    return Array.from(elements).map(el => el.textContent.trim());
                };

                // Extract basic case information
                const title = extractText('.case-title, .case-header, h2, h3');
                const parties = extractText('.parties, .case-parties');
                const filingDate = extractText('.filing-date, .date-filed');
                const nextHearingDate = extractText('.next-hearing, .hearing-date');
                const judgeName = extractText('.judge, .bench');

                // Extract PDF links
                const pdfLinks = Array.from(document.querySelectorAll('a[href*=".pdf"]')).map(link => ({
                    url: link.href,
                    text: link.textContent.trim(),
                    type: link.textContent.toLowerCase().includes('order') ? 'order' : 'judgment'
                }));

                // Extract order history if available
                const orderRows = extractAllText('.order-row, .hearing-row, tr');
                const orders = orderRows.map((row, index) => ({
                    date: '',
                    description: row,
                    order: index + 1
                }));

                return {
                    title: title || 'Case Details',
                    parties: parties || 'Not available',
                    filingDate: filingDate || 'Not available',
                    nextHearingDate: nextHearingDate || 'Not available',
                    judgeName: judgeName || 'Not available',
                    orders: orders.length > 0 ? orders : [],
                    pdfLinks: pdfLinks
                };
            });

            return caseData;
        } catch (error) {
            console.error('Error extracting case details:', error);
            return {
                title: 'Error extracting data',
                parties: 'Not available',
                filingDate: 'Not available',
                nextHearingDate: 'Not available',
                judgeName: 'Not available',
                orders: [],
                pdfLinks: []
            };
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log('Browser closed');
        }
    }

    // Method to handle CAPTCHA manually
    async solveCaptcha(captchaText) {
    if (!this.page) return false;
    
    try {
        // Try multiple possible CAPTCHA input selectors
        const captchaInputSelectors = [
            '#captcha_input',
            '#captcha',
            'input[name="captcha"]',
            'input[name="captcha_code"]',
            'input[name="security_code"]',
            'input[placeholder*="captcha"]',
            'input[placeholder*="CAPTCHA"]',
            '.captcha-input',
            '#security_code'
        ];

        let inputFound = false;
        for (const selector of captchaInputSelectors) {
            const element = await this.page.$(selector);
            if (element) {
                // Clear any existing text first
                await this.page.evaluate((sel) => {
                    const input = document.querySelector(sel);
                    if (input) input.value = '';
                }, selector);
                
                // Type the CAPTCHA text
                await this.page.type(selector, captchaText);
                console.log(`CAPTCHA entered using selector: ${selector}`);
                inputFound = true;
                break;
            }
        }

        if (!inputFound) {
            console.error('CAPTCHA input field not found');
            return false;
        }

        // Now try to submit the form
        const submitSelectors = [
            '#search_button', 
            'input[type="submit"]', 
            'button[type="submit"]',
            '.submit-btn',
            '.search-btn',
            'input[value*="Search"]',
            'input[value*="Submit"]',
            'button:contains("Search")',
            'button:contains("Submit")'
        ];

        let submitted = false;
        for (const selector of submitSelectors) {
            const element = await this.page.$(selector);
            if (element) {
                await this.page.click(selector);
                console.log(`Form submitted using selector: ${selector}`);
                submitted = true;
                break;
            }
        }

        if (!submitted) {
            console.error('Submit button not found after CAPTCHA entry');
            return false;
        }

        // Wait for response
        await this.page.waitForNavigation({ 
            waitUntil: 'networkidle0', 
            timeout: 15000 
        }).catch(() => {
            console.log('Navigation timeout - form might have been submitted');
        });

        return true;

    } catch (error) {
        console.error('Error in solveCaptcha:', error);
        return false;
    }
}
    // In courtScraper.js, add this method:
async getCaptchaImage() {
    try {
        const captchaImg = await this.page.$('#captcha_image, .captcha-image, img[src*="captcha"]');
        if (captchaImg) {
            const screenshot = await captchaImg.screenshot();
            return screenshot.toString('base64');
        }
        return null;
    } catch (error) {
        console.error('Error getting CAPTCHA image:', error);
        return null;
    }
}
}

module.exports = CourtScraper;