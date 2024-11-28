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
var productsLocal = [];
var products = [];

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/market_scraper", {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));
// Configure CORS
app.use(cors({
  origin: 'http://localhost:3001', // Replace with your frontend URL
  methods: 'GET,POST,PUT,DELETE',
  allowedHeaders: 'Content-Type,Authorization'
}));
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
  const averagePrice = products.reduce((sum, product) => sum + product.price, 0) / products.length;

  const vendorCounts = products.reduce((counts, product) => {
    counts[product.vendor] = (counts[product.vendor] || 0) + 1;
    return counts;
  }, {});

  const categoryCounts = products.reduce((counts, product) => {
    counts[product.category] = (counts[product.category] || 0) + 1;
    return counts;
  }, {});

  const priceDistribution = products.reduce((distribution, product) => {
    const priceRange = Math.floor(product.price / 10) * 10;
    distribution[priceRange] = (distribution[priceRange] || 0) + 1;
    return distribution;
  }, {});

  const topVendors = Object.entries(vendorCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return { averagePrice, topVendors, topCategories, priceDistribution };
};

// Endpoint: Fetch Data and Generate Visualization
app.get('/api/visualization', async (req, res) => {
  try {
    // Fetch Data
    const products = await Product.find();
    console.log("Fetched products:", products);

    // Clean Data
    const cleanedProducts = cleanData(products);
    console.log("Cleaned products:", cleanedProducts);

    // Analyze Data
    const { averagePrice, topVendors, topCategories, priceDistribution } = analyzeData(cleanedProducts);
    console.log("Average Price:", averagePrice);
    console.log("Top Vendors:", topVendors);
    console.log("Top Categories:", topCategories);
    console.log("Price Distribution:", priceDistribution);

    // Generate Visualizations
    const vendorChartData = {
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

    const categoryChartData = {
      labels: topCategories.map((c) => c[0]), // Category names
      datasets: [
        {
          label: 'Top Categories by Product Count',
          data: topCategories.map((c) => c[1]), // Product counts
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        },
      ],
    };

    const priceDistributionChartData = {
      labels: Object.keys(priceDistribution), // Price ranges
      datasets: [
        {
          label: 'Price Distribution',
          data: Object.values(priceDistribution), // Product counts
          backgroundColor: 'rgba(153, 102, 255, 0.2)',
          borderColor: 'rgba(153, 102, 255, 1)',
          borderWidth: 1,
        },
      ],
    };

    res.status(200).json({ vendorChartData, categoryChartData, priceDistributionChartData, averagePrice });
  } catch (error) {
    console.error('Error generating visualization:', error);
    res.status(500).json({ error: error.message });
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
  var { url, receivedSite } = req.body;
  console.log("scrape-ecom-cheerio received : ", req.body);
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
    const proxyUrl = `http://api.scraperapi.com?api_key=8dcef76ad04710bd64b4362e9ded6185&url=`+url;
    const site = receivedSite;
    const { data } = await axios.get(proxyUrl);
    const $ = cheerio.load(data);

    // Example for extracting Amazon-like or Flipkart-like data
    products = [];
    $('div.s-main-slot > div.s-result-item').each((index, element) => {
      const name = $(element).find('h2.a-size-mini > a.a-link-normal').text().trim();
      const price = $(element).find('span.a-price > span.a-offscreen').text().trim();
      const description = $(element).find('div.a-row.a-size-base.a-color-secondary').text().trim();
      const discount = $(element).find('span.savingsPercentage').text().trim();
      const vendor = $(element).find('span.a-size-base-plus.a-color-base').text().trim();
  
      products.push({ name, price, description, discount, vendor });
    });
    productsLocal = products;
    for (const product of products) {
      await saveProduct(product);
    }
    res.status(200).json({ message: 'Data scraped and saved', products });

    console.log(`Scraped ${products.length} products from ${receivedSite}`);
  } catch (error) {
    console.error(`Error scraping ${site}: ${error.message}`);
    res.status(500).json({ message: 'Error scraping data', error });
  }
});



app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
