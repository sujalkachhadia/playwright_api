require('dotenv').config();
const express = require('express');
const { chromium } = require('playwright');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer <token>

    if (token == null) return res.status(401).json({ error: 'Token required' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
}

// Endpoint to generate a token for testing
app.post('/login', (req, res) => {
    // For simplicity, we accept any username/password and return a token
    const username = req.body.username || 'activepieces-user';
    const user = { name: username };

    // Generate a token that expires in 1 hour
    const accessToken = jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
    res.json({ accessToken });
});

const PORT = process.env.PORT || 3000;

app.get('/scrape-n8n', authenticateToken, async (req, res) => {
    let browser;
    try {
        // Launch a hidden Chrome browser with Docker-friendly flags
        browser = await chromium.launch({ 
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--single-process'
            ]
        });
        const page = await browser.newPage();
        
        // Go to the n8n integrations page
        await page.goto('https://n8n.io/integrations/');
        
        // Wait 3 seconds for the dynamic integration cards to fully load initially
        await page.waitForTimeout(3000); 

        // Click "Load more" until all nodes are loaded
        let keepLoading = true;
        while (keepLoading) {
            try {
                // Find the Load more button
                const loadMoreBtn = page.getByRole('button', { name: /Load more/i });
                
                if (await loadMoreBtn.isVisible()) {
                    await loadMoreBtn.click();
                    // Wait a moment for the new items to fetch and render
                    await page.waitForTimeout(2000);
                } else {
                    keepLoading = false;
                }
            } catch (err) {
                // If the button can't be found or clicked, we assume we reached the end
                keepLoading = false;
            }
        }
        
        // Extract the app names from the cards
        const nodeNames = await page.$$eval('a[href*="/integrations/"] p, a[href*="/integrations/"] h3, a[href*="/integrations/"] span', elements => {
            return elements.map(el => el.textContent.trim()).filter(text => text.length > 0);
        });
        
        // Remove duplicates
        const uniqueNodes = [...new Set(nodeNames)];
        
        res.json({ success: true, count: uniqueNodes.length, nodes: uniqueNodes });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (browser) await browser.close();
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Playwright Scraper API is running on http://localhost:${PORT}`);
});
