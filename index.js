// backend/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const routes = require('./routes');
const ScrapedData = require('./models/ScrapedData'); // Import the ScrapedData model

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

app.use(cors());
app.use(express.json());
app.use('/api', routes);

app.post('/api/scrape', async (req, res) => {
    const { url, fields, method } = req.body;
    try {
        const data = await scrapeData(url, fields, method);
        console.log("Received data : ", JSON.stringify(data));
        const scrapedData = new ScrapedData({ url, data });
        await scrapedData.save();
        res.status(200).json({ message: 'Data scraped and saved', data });
    } catch (error) {
        console.error('Error scraping data:', error);
        res.status(500).json({ message: 'Error scraping data', error });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
