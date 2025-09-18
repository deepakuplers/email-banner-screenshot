// api/screenshot.js - Vercel Serverless Function
const puppeteer = require('puppeteer-core');
const chromium = require('chrome-aws-lambda');

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { code, apiKey } = req.body;

        // API Key validation
        if (apiKey !== '1234') {
            return res.status(403).json({ message: 'Invalid API Key' });
        }

        // Validate input
        if (!code || code.trim() === '') {
            return res.status(400).json({ message: 'HTML/CSS code is required' });
        }

        // Launch Puppeteer with Vercel-compatible settings
        const browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
            ],
            defaultViewport: {
                width: 1200,
                height: 800,
                deviceScaleFactor: 2
            },
            executablePath: await chromium.executablePath,
            headless: chromium.headless,
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
            await page.setContent(code, {
                waitUntil: ['networkidle0', 'domcontentloaded'],
                timeout: 15000
            });
            
            // Wait a bit more for any CSS animations/transitions
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
        res.setHeader('Cache-Control', 'no-cache');
        
        // Send the screenshot
        return res.send(screenshotBuffer);

    } catch (error) {
        console.error('Screenshot generation error:', error);
        return res.status(500).json({ 
            message: 'Failed to generate screenshot',
            error: error.message 
        });
    }
}