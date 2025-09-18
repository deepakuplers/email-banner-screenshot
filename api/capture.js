// api/capture.js - Simple Website Screenshot API
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

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
        const { url, device = 'desktop', quality = 'high' } = req.body;

        // Validate URL
        if (!url || !url.trim()) {
            return res.status(400).json({ message: 'URL is required' });
        }

        // Validate URL format
        try {
            new URL(url);
        } catch (error) {
            return res.status(400).json({ message: 'Invalid URL format' });
        }

        // Device configurations
        const deviceConfigs = {
            desktop: {
                width: 1920,
                height: 1080,
                deviceScaleFactor: 1,
                isMobile: false
            },
            tablet: {
                width: 768,
                height: 1024,
                deviceScaleFactor: 2,
                isMobile: true
            },
            mobile: {
                width: 375,
                height: 667,
                deviceScaleFactor: 2,
                isMobile: true
            }
        };

        // Quality settings
        const qualitySettings = {
            high: { quality: 100, deviceScaleFactor: 2 },
            medium: { quality: 80, deviceScaleFactor: 1.5 },
            low: { quality: 60, deviceScaleFactor: 1 }
        };

        const deviceConfig = deviceConfigs[device] || deviceConfigs.desktop;
        const qualitySetting = qualitySettings[quality] || qualitySettings.high;

        // Configure Chromium for Vercel
        const isLocal = process.env.NODE_ENV !== 'production';
        
        // Launch browser
        const browser = await puppeteer.launch({
            args: isLocal 
                ? []
                : [
                    ...chromium.args,
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--hide-scrollbars',
                    '--disable-web-security',
                    '--no-first-run'
                ],
            defaultViewport: {
                width: deviceConfig.width,
                height: deviceConfig.height,
                deviceScaleFactor: qualitySetting.deviceScaleFactor,
                isMobile: deviceConfig.isMobile,
                hasTouch: deviceConfig.isMobile,
                isLandscape: false
            },
            executablePath: isLocal
                ? undefined
                : await chromium.executablePath(),
            headless: true,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();

        // Set user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

        // Set viewport
        await page.setViewport({
            width: deviceConfig.width,
            height: deviceConfig.height,
            deviceScaleFactor: qualitySetting.deviceScaleFactor,
            isMobile: deviceConfig.isMobile,
            hasTouch: deviceConfig.isMobile,
            isLandscape: false
        });

        // Navigate to URL with timeout
        try {
            await page.goto(url, {
                waitUntil: ['networkidle0', 'domcontentloaded'],
                timeout: 30000
            });

            // Wait for page to fully load
            await page.waitForTimeout(2000);

        } catch (navigationError) {
            await browser.close();
            return res.status(400).json({
                message: 'Failed to load the website',
                error: navigationError.message
            });
        }

        // Take screenshot
        const screenshotBuffer = await page.screenshot({
            type: 'png',
            quality: qualitySetting.quality,
            fullPage: true,
            omitBackground: false,
        });

        await browser.close();

        // Set response headers
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Length', screenshotBuffer.length);
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
        
        // Send screenshot
        return res.send(screenshotBuffer);

    } catch (error) {
        console.error('Screenshot capture error:', error);
        return res.status(500).json({
            message: 'Failed to capture screenshot',
            error: error.message
        });
    }
}