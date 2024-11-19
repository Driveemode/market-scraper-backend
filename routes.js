// backend/routes.js
const express = require('express');
const ScrapedData = require('./models/ScrapedData'); // Import the ScrapedData model
const { scrapeData } = require('./scraper');

const router = express.Router();

router.post('/scrape', async (req, res) => {
    const { url, fields, method } = req.body;
    try {
        const data = await scrapeData(url, fields, method);
        console.log("Received data : ", JSON.stringify(data));
        const scrapedData = new ScrapedData({ url, data });
        await scrapedData.save();
        res.status(200).json({ message: 'Data scraped and saved', data });
    } catch (error) {
        console.error('Error scraping data:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
