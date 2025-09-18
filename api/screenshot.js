// api/screenshot.js - Vercel Serverless Function for HTML/CSS Screenshots
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

// Define your API key for authentication
const API_KEY = '1234';  // Change this to a real API key

module.exports = async function handler(req, res) {
    // Set CORS headers for all requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Handle GET request (for testing)
    if (req.method === 'GET') {
        return res.status(200).json({ 
            message: 'HTML & CSS Screenshot Generator API is running',
            status: 'healthy',
            timestamp: new Date().toISOString()
        });
    }

    // Only allow POST requests for screenshot generation
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { code, apiKey } = req.body;

        // API Key validation
        if (apiKey !== API_KEY) {
            return res.status(403).json({ message: 'Invalid API Key' });
        }

        // Validate input
        if (!code || code.trim() === '') {
            return res.status(400).json({ message: 'HTML/CSS code is required' });
        }

        // Auto-wrap incomplete HTML - be very flexible
        let processedCode = code;
        const lowerCode = code.toLowerCase();
        
        // If it doesn't look like complete HTML, wrap it
        if (!lowerCode.includes('<!doctype') && !lowerCode.includes('<html')) {
            processedCode = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Screenshot</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
    </style>
</head>
<body>
${code}
</body>
</html>`;
        }

        // Configure Chromium for Vercel
        const isLocal = process.env.NODE_ENV !== 'production';
        
        // Launch Puppeteer with @sparticuz/chromium
        const browser = await puppeteer.launch({
            args: isLocal 
                ? []
                : [
                    ...chromium.args,
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-extensions',
                    '--hide-scrollbars',
                    '--disable-web-security',
                    '--no-first-run'
                ],
            defaultViewport: {
                width: 1200,
                height: 800,
                deviceScaleFactor: 2
            },
            executablePath: isLocal
                ? undefined
                : await chromium.executablePath(),
            headless: true,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();

        // Set viewport for consistent screenshots
        await page.setViewport({
            width: 1200,
            height: 800,
            deviceScaleFactor: 2
        });

        // Set content with better error handling
        try {
            await page.setContent(processedCode, {
                waitUntil: ['networkidle0', 'domcontentloaded'],
                timeout: 15000
            });
            
            // Wait for any CSS animations/transitions
            await page.waitForTimeout(1000);
        } catch (contentError) {
            await browser.close();
            return res.status(400).json({ 
                message: 'Invalid HTML content or timeout',
                error: contentError.message 
            });
        }

        // Take screenshot with optimized settings
        const screenshotBuffer = await page.screenshot({
            fullPage: true,
            type: 'png',
            quality: 100,
            omitBackground: false,
        });

        await browser.close();

        // Set response headers for image
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Length', screenshotBuffer.length);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        
        // Send the screenshot
        return res.send(screenshotBuffer);

    } catch (error) {
        console.error('Screenshot generation error:', error);
        return res.status(500).json({ 
            message: 'Failed to generate screenshot',
            error: error.message 
        });
    }
};