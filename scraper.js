// backend/scraper.js
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const { Builder, By, until } = require('selenium-webdriver');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const request = require('request-promise');
const playwright = require('playwright');

async function scrapeData(url, fields, method) {
    if (method === 'cheerio') {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        let scrapedData = {};
        fields.forEach(field => {
            scrapedData[field.name] = $(field.selector).text();
        });
        return scrapedData;
    } else if (method === 'puppeteer') {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(url);
        let scrapedData = {};
        for (const field of fields) {
            scrapedData[field.name] = await page.$eval(field.selector, el => el.innerText);
        }
        await browser.close();
        return scrapedData;
    } else if (method === 'selenium') {
        return await scrapeWithSelenium(url, fields);
    } else if (method === 'jsdom') {
        return await scrapeWithJSDOM(url, fields);
    } else if (method === 'request-cheerio') {
        return await scrapeWithRequestCheerio(url, fields);
    } else if (method === 'playwright') {
        return await scrapeWithPlaywright(url, fields);
    } else if (method === 'axios') {
        return await scrapeWithAxios(url, fields);
    }
    throw new Error('Invalid scraping method');
}

async function scrapeWithSelenium(url, fields) {
    let driver = await new Builder().forBrowser('chrome').build();
    try {
        await driver.get(url);
        let scrapedData = {};
        for (const field of fields) {
            let element = await driver.findElement(By.css(field.selector));
            scrapedData[field.name] = await element.getText();
        }
        return scrapedData;
    } finally {
        await driver.quit();
    }
}

async function scrapeWithJSDOM(url, fields) {
    const response = await axios.get(url);
    const dom = new JSDOM(response.data);
    const document = dom.window.document;
    let scrapedData = {};
    fields.forEach(field => {
        scrapedData[field.name] = document.querySelector(field.selector).textContent;
    });
    return scrapedData;
}

async function scrapeWithRequestCheerio(url, fields) {
    const response = await request(url);
    const $ = cheerio.load(response);
    let scrapedData = {};
    fields.forEach(field => {
        scrapedData[field.name] = $(field.selector).text();
    });
    return scrapedData;
}

async function scrapeWithPlaywright(url, fields) {
    const browser = await playwright.chromium.launch();
    const page = await browser.newPage();
    await page.goto(url);
    let scrapedData = {};
    for (const field of fields) {
        scrapedData[field.name] = await page.$eval(field.selector, el => el.innerText);
    }
    await browser.close();
    return scrapedData;
}

async function scrapeWithAxios(url, fields) {
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive'
        }
    });

    const $ = cheerio.load(response.data);
    let scrapedData = {};
    fields.forEach(field => {
        scrapedData[field.name] = $(field.selector).text().trim();
    });
    return scrapedData;
}

// async function sendTestRequests() {
//     const testCase = {
//         url: 'https://www.amazon.in/dp/B08N5WRWNW', // Example product page URL
//         fields: [
//             { name: 'title', selector: '#productTitle' },
//             { name: 'price', selector: '.a-price .a-offscreen' },
//             { name: 'description', selector: '#feature-bullets ul' }
//         ],
//         method: 'axios'
//     };

//     try {
//         const data = await scrapeWithAxios(testCase.url, testCase.fields);
//         console.log(`Response for method ${testCase.method}:`, data);
//     } catch (error) {
//         console.error(`Error for method ${testCase.method}:`, error.message);
//     }
// }

// sendTestRequests();

module.exports = { scrapeData };
