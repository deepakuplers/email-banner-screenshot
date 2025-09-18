// api/screenshot.js - Vercel Serverless Function for HTML/CSS Screenshots
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

// Define your API key for authentication
const API_KEY = '1234';  // Change this to a real API key

export default async function handler(req, res) {
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

        // HTML/CSS Validation (basic)
        const validationErrors = validateHTMLCSS(code);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                message: 'Code validation failed',
                error: 'HTML/CSS syntax errors detected',
                details: validationErrors
            });
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
            await page.setContent(code, {
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
}

// Function to validate HTML/CSS code
function validateHTMLCSS(code) {
    const errors = [];
    
    try {
        // Basic HTML structure validation
        const lowerCode = code.toLowerCase();
        
        if (!lowerCode.includes('<!doctype html>') && !lowerCode.includes('<!doctype')) {
            errors.push('Missing DOCTYPE declaration');
        }
        
        if (!lowerCode.includes('<html')) {
            errors.push('Missing <html> tag');
        }
        
        if (!lowerCode.includes('</html>')) {
            errors.push('Missing closing </html> tag');
        }
        
        if (!lowerCode.includes('<head')) {
            errors.push('Missing <head> section');
        }
        
        if (!lowerCode.includes('<body')) {
            errors.push('Missing <body> section');
        }

        // Check for basic tag balance
        const openTags = code.match(/<[^/!][^>]*>/g) || [];
        const closeTags = code.match(/<\/[^>]*>/g) || [];
        
        // Simple validation - if there's a big imbalance, there might be unclosed tags
        if (Math.abs(openTags.length - closeTags.length) > 5) {
            errors.push('Possible unclosed HTML tags detected');
        }

        // CSS syntax validation (basic)
        const styleBlocks = code.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
        styleBlocks.forEach((block, index) => {
            const cssContent = block.replace(/<\/?style[^>]*>/gi, '');
            const openBraces = (cssContent.match(/{/g) || []).length;
            const closeBraces = (cssContent.match(/}/g) || []).length;
            
            if (openBraces !== closeBraces) {
                errors.push(`CSS syntax error in style block ${index + 1}: Mismatched braces`);
            }
        });

        // Check for common HTML errors
        if (code.includes('<<') || code.includes('>>')) {
            errors.push('Invalid HTML syntax: Double angle brackets detected');
        }

    } catch (error) {
        errors.push('Code parsing error: ' + error.message);
    }
    
    return errors;
}