const puppeteer = require('puppeteer');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();

// Define your API key for authentication
const API_KEY = '1234';  // Change this to a real API key

// Middleware to parse JSON data
app.use(bodyParser.json());

// Serve the HTML page for user input (for testing)
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// API endpoint to generate screenshot from HTML/CSS code
app.post('/api/screenshot', async (req, res) => {
    const { code, apiKey } = req.body;  // Get the combined HTML/CSS code from the user

    // Check if the API key is valid
    if (apiKey !== API_KEY) {
        return res.status(403).json({ message: 'Invalid API Key' });  // Unauthorized
    }

    // Launch Puppeteer browser
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();

    // Set the content of the page (HTML + CSS combined code)
    await page.setContent(code);

    // Take a full-page screenshot (captures the entire page, including beyond the viewport)
    const screenshotBuffer = await page.screenshot({ fullPage: true });

    // Close the browser after taking the screenshot
    await browser.close();

    // Send the screenshot back to the frontend as a PNG image
    res.contentType('image/png');
    res.send(screenshotBuffer);
});

// Start the server on port 3000
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
