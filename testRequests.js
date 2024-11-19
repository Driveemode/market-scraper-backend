const axios = require('axios');
const puppeteer = require('puppeteer');

const testCases = [
    {
        url: 'https://www.amazon.in/dp/B08N5WRWNW', // Example product page URL
        fields: [
            { name: 'title', selector: '#productTitle' },
            { name: 'price', selector: '.a-price .a-offscreen' },
            { name: 'description', selector: '#feature-bullets ul' }
        ],
        method: 'cheerio'
    },
    {
        url: 'https://example.com',
        fields: [
            { name: 'header', selector: 'h1' },
            { name: 'paragraph', selector: 'p' }
        ],
        method: 'puppeteer'
    },
    {
        url: 'https://example.com',
        fields: [
            { name: 'header', selector: 'h1' },
            { name: 'paragraph', selector: 'p' }
        ],
        method: 'selenium'
    },
    {
        url: 'https://example.com',
        fields: [
            { name: 'header', selector: 'h1' },
            { name: 'paragraph', selector: 'p' }
        ],
        method: 'jsdom'
    },
    {
        url: 'https://example.com',
        fields: [
            { name: 'header', selector: 'h1' },
            { name: 'paragraph', selector: 'p' }
        ],
        method: 'request-cheerio'
    },
    {
        url: 'https://example.com',
        fields: [
            { name: 'header', selector: 'h1' },
            { name: 'paragraph', selector: 'p' }
        ],
        method: 'playwright'
    }
];

async function scrapeWithPuppeteer(url, fields) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    let scrapedData = {};
    for (const field of fields) {
        try {
            scrapedData[field.name] = await page.$eval(field.selector, el => el.innerText.trim());
        } catch (error) {
            scrapedData[field.name] = 'N/A';
        }
    }

    await browser.close();
    return scrapedData;
}

async function sendTestRequests() {
    for (const testCase of testCases) {
        try {
            if (testCase.method === 'puppeteer') {
                const data = await scrapeWithPuppeteer(testCase.url, testCase.fields);
                console.log(`Response for method ${testCase.method}:`, data);
            } else {
                const response = await axios.post('http://localhost:3000/api/scrape', testCase);
                console.log(`Response for method ${testCase.method}:`, response.data);
            }
        } catch (error) {
            console.error(`Error for method ${testCase.method}:`, error.response ? error.response.data : error.message);
        }
    }
}

sendTestRequests();