// backend/index.js
require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const routes = require('./routes');
const ScrapedData = require('./models/ScrapedData'); // Import the ScrapedData model
const Bottleneck = require('bottleneck');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

const app = express();
const PORT = process.env.PORT || 3000;
const limiter = new Bottleneck({
  minTime: 1000, // 1 second between requests
});

// Connect to MongoDB
mongoose.connect("mongodb://172.17.0.2:27017/market_scraper", {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));
const productSchema = new mongoose.Schema({
  name: String,
  price: String,
  description: String,
  discount: String,
  vendors: [String],
  url: String,
  scrapedAt: { type: Date, default: Date.now },
});
const Product = mongoose.model('Product', productSchema);
// Chart Configuration
const width = 800; // Chart width
const height = 600; // Chart height
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

// Helper Function: Clean Data
const cleanData = (products) => {
  return products.map((product) => ({
    ...product,
    price: parseFloat(product.price.replace(/₹|,/g, '')) || 0, // Convert ₹12,999 to 12999
    discount: parseFloat(product.discount.replace('%', '')) || 0, // Convert 10% to 10
  }));
};

// Helper Function: Analyze Data
const analyzeData = (products) => {
  const totalProducts = products.length;
  const totalPrice = products.reduce((sum, product) => sum + product.price, 0);
  const averagePrice = (totalPrice / totalProducts).toFixed(2);

  const vendorCounts = {};
  products.forEach((product) => {
    product.vendors.forEach((vendor) => {
      vendorCounts[vendor] = (vendorCounts[vendor] || 0) + 1;
    });
  });

  const topVendors = Object.entries(vendorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return { averagePrice, topVendors };
};

// Endpoint: Fetch Data and Generate Visualization
app.get('/api/visualization', async (req, res) => {
  try {
    // Fetch Data
    const products = await Product.find();
    const cleanedProducts = cleanData(products);

    // Analyze Data
    const { averagePrice, topVendors } = analyzeData(cleanedProducts);

    // Generate Visualization
    const chartData = {
      labels: topVendors.map((v) => v[0]), // Vendor names
      datasets: [
        {
          label: 'Top Vendors by Product Count',
          data: topVendors.map((v) => v[1]), // Product counts
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
        },
      ],
    };

    const chartConfiguration = {
      type: 'bar',
      data: chartData,
      options: {
        plugins: {
          title: {
            display: true,
            text: `Average Price: ₹${averagePrice}`,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    };

    const image = await chartJSNodeCanvas.renderToBuffer(chartConfiguration);

    // Send Chart as Response
    res.set('Content-Type', 'image/png');
    res.send(image);
  } catch (error) {
    console.error('Error generating visualization:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
const saveProduct = async (product) => {
  try {
    const existingProduct = await Product.findOne({ name: product.name, url: product.url });
    if (existingProduct) {
      console.log(`Product already exists: ${product.name}`);
    } else {
      const newProduct = new Product(product);
      await newProduct.save();
      console.log(`Saved: ${product.name}`);
    }
  } catch (error) {
    console.error(`Error saving product: ${error.message}`);
  }
};
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
app.post('/api/scrape-ecom-cheerio', async (req, res) => {
  const { url, site } = req.body;
  // try {
  //     const data = await scrapeData(url, fields, method);
  //     console.log("Received data : ", JSON.stringify(data));
  //     const scrapedData = new ScrapedData({ url, data });
  //     await scrapedData.save();
  //     res.status(200).json({ message: 'Data scraped and saved', data });
  // } catch (error) {
  //     console.error('Error scraping data:', error);
  //     res.status(500).json({ message: 'Error scraping data', error });
  // }
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
    };
    const proxyUrl = `http://api.scraperapi.com?api_key=8dcef76ad04710bd64b4362e9ded6185&url=https://www.amazon.in/s?k=laptops`;
    const { data } = await axios.get(proxyUrl);
    const $ = cheerio.load(data);

    // Example for extracting Amazon-like or Flipkart-like data
    const products = [];
    $('div.s-main-slot > div.s-result-item').each((index, element) => {
      const name = $(element).find('h2.a-size-mini > a.a-link-normal').text().trim();
      const price = $(element).find('span.a-price > span.a-offscreen').text().trim();
      const description = $(element).find('div.a-row.a-size-base.a-color-secondary').text().trim();
      const discount = $(element).find('span.savingsPercentage').text().trim();
      const vendor = $(element).find('span.a-size-base-plus.a-color-base').text().trim();
  
      products.push({ name, price, description, discount, vendor });
    });

    for (const product of products) {
      await saveProduct(product);
    }
    res.status(200).json({ message: 'Data scraped and saved', data });

    console.log(`Scraped ${products.length} products from ${site}`);
  } catch (error) {
    console.error(`Error scraping ${site}: ${error.message}`);
    res.status(500).json({ message: 'Error scraping data', error });
  }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
