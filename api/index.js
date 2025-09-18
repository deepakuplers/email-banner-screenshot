// api/screenshot.js - Vercel serverless function
const puppeteer = require('puppeteer-core');
const chromium = require('chrome-aws-lambda');

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
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

        // Launch Puppeteer with chrome-aws-lambda for Vercel
        const browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
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

        // Set content with error handling
        try {
            await page.setContent(code, {
                waitUntil: 'networkidle0',
                timeout: 10000
            });
        } catch (contentError) {
            await browser.close();
            return res.status(400).json({ message: 'Invalid HTML content' });
        }

        // Take screenshot
        const screenshotBuffer = await page.screenshot({
            fullPage: true,
            type: 'png',
            quality: 90
        });

        await browser.close();

        // Set response headers
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Length', screenshotBuffer.length);
        
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