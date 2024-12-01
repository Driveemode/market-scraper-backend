// backend/index.js
require("dotenv").config();
const axios = require("axios");
const cheerio = require("cheerio");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const routes = require("./routes");
const ScrapedData = require("./models/ScrapedData"); // Import the ScrapedData model
const Bottleneck = require("bottleneck");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const puppeteer = require('puppeteer');
// const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const limiter = new Bottleneck({
  minTime: 1000, // 1 second between requests
});
var productsLocal = [];
var products = [];

// Connect to MongoDB
mongoose
  .connect("mongodb://localhost:27017/market_scraper", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));
// Configure CORS
app.use(cors({
  origin: 'http://localhost:3001', // Update with your frontend URL
  methods: 'GET,POST,PUT,DELETE',
  allowedHeaders: 'Content-Type,Authorization,Cache-Control'
}));
const productSchema = new mongoose.Schema({
  name: String,
  price: String,
  originalPrice: String,
  description: String,
  discount: String,
  reviews: String,
  rating: String,
  availability: String,
  badge: String,
  image: String,
  vendors: [String],
  url: String,
  scrapedAt: { type: Date, default: Date.now },
});
const Product = mongoose.model("Product", productSchema);
// Chart Configuration
const width = 800; // Chart width
const height = 600; // Chart height
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

// Helper Function: Clean Data
const cleanData = (products) => {
  return products.map((product) => ({
    ...product,
    price: parseFloat(product.price.replace(/₹|,/g, "")) || 0, // Convert ₹12,999 to 12999
    discount: parseFloat(product.discount.replace("%", "")) || 0, // Convert 10% to 10
  }));
};

// Helper Function: Analyze Data
const analyzeData = (products) => {
  const averagePrice =
    products.reduce((sum, product) => sum + product.price, 0) / products.length;

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

  const topVendors = Object.entries(vendorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return { averagePrice, topVendors, topCategories, priceDistribution };
};

// Endpoint: Fetch Data and Generate Visualization
app.get("/api/visualization", async (req, res) => {
  try {
    // Fetch Data
    const products = await Product.find();
    console.log("Fetched products:", products);

    // Clean Data
    const cleanedProducts = cleanData(products);
    console.log("Cleaned products:", cleanedProducts);

    // Analyze Data
    const { averagePrice, topVendors, topCategories, priceDistribution } =
      analyzeData(cleanedProducts);
    console.log("Average Price:", averagePrice);
    console.log("Top Vendors:", topVendors);
    console.log("Top Categories:", topCategories);
    console.log("Price Distribution:", priceDistribution);

    // Generate Visualizations
    const vendorChartData = {
      labels: topVendors.map((v) => v[0]), // Vendor names
      datasets: [
        {
          label: "Top Vendors by Product Count",
          data: topVendors.map((v) => v[1]), // Product counts
          backgroundColor: "rgba(54, 162, 235, 0.2)",
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 1,
        },
      ],
    };

    const categoryChartData = {
      labels: topCategories.map((c) => c[0]), // Category names
      datasets: [
        {
          label: "Top Categories by Product Count",
          data: topCategories.map((c) => c[1]), // Product counts
          backgroundColor: "rgba(75, 192, 192, 0.2)",
          borderColor: "rgba(75, 192, 192, 1)",
          borderWidth: 1,
        },
      ],
    };

    const priceDistributionChartData = {
      labels: Object.keys(priceDistribution), // Price ranges
      datasets: [
        {
          label: "Price Distribution",
          data: Object.values(priceDistribution), // Product counts
          backgroundColor: "rgba(153, 102, 255, 0.2)",
          borderColor: "rgba(153, 102, 255, 1)",
          borderWidth: 1,
        },
      ],
    };

    res
      .status(200)
      .json({
        vendorChartData,
        categoryChartData,
        priceDistributionChartData,
        averagePrice,
      });
  } catch (error) {
    console.error("Error generating visualization:", error);
    res.status(500).json({ error: error.message });
  }
});
const saveProduct = async (product) => {
  try {
    const existingProduct = await Product.findOne({
      name: product.name,
      url: product.url,
    });
    if (existingProduct) {
      // console.log(`Product already exists: ${product.name}`);
    } else {
      const newProduct = new Product(product);
      await newProduct.save();
      // console.log(`Saved: ${product.name}`);
    }
  } catch (error) {
    console.error(`Error saving product: ${error.message}`);
  }
};
app.use(cors());
app.use(express.json());
app.use("/api", routes);

app.post("/api/scrape", async (req, res) => {
  const { url, fields, method } = req.body;
  try {
    const data = await scrapeData(url, fields, method);
    console.log("Received data : ", JSON.stringify(data));
    const scrapedData = new ScrapedData({ url, data });
    await scrapedData.save();
    res.status(200).json({ message: "Data scraped and saved", data });
  } catch (error) {
    console.error("Error scraping data:", error);
    res.status(500).json({ message: "Error scraping data", error });
  }
});
app.post("/api/scrape-ecom-cheerio", async (req, res) => {
  const { url, site } = req.body;
  console.log("Scraping data obj ", req.body);
  if (site !== "All" && site !== undefined) {
    console.log("Scraping data from ", site);
    const scraperApiKey = "8dcef76ad04710bd64b4362e9ded6185";
    try {
      const headers = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
      };
      // const proxyUrl =
      //   `http://api.scraperapi.com?api_key=8dcef76ad04710bd64b4362e9ded6185&url=` +
      //   url;
      // const { data } = await axios.get(proxyUrl, { headers });
      // const $ = cheerio.load(data);
      const siteConfigs = [
        walmartConfig,
        amazonUSConfig,
        bestBuyConfig,
        aliExpressConfig,
      ];
      const products = [];
      for (const config of siteConfigs) {
        if(site === config.siteName ){
          console.log(`Scraping ${config.siteName}...`);
          const siteResults = await scrapeWebsite(url, config, scraperApiKey);
          products.push(...siteResults);
        }else{
          // scrapeWalmart(config.url);
        }
      }
      // const siteResults = await scrapeWebsite(
      //   config.url,
      //   config,
      //   scraperApiKey
      // );
      // products.push(...siteResults);

      // // Example for extracting Amazon-like or Flipkart-like data
      // $("div.s-main-slot > div.s-result-item").each((_, element) => {
      //   const name = $(element)
      //     .find("h2.a-size-mini > a.a-link-normal")
      //     .text()
      //     .trim();
      //   const price = $(element)
      //     .find("span.a-price > span.a-offscreen")
      //     .text()
      //     .trim();
      //   const description = $(element)
      //     .find("div.a-row.a-size-base.a-color-secondary")
      //     .text()
      //     .trim();
      //   const discount = $(element)
      //     .find("span.savingsPercentage")
      //     .text()
      //     .trim();
      //   const vendor = $(element)
      //     .find("span.a-size-base-plus.a-color-base")
      //     .text()
      //     .trim();

      //   products.push({ name, price, description, discount, vendor });
      // });

      // productsLocal = products;
      // for (const product of products) {
      //   await saveProduct(product);
      // }
      // Save to MongoDB
      for (const product of products) {
        try {
          await Product.create(product);
        } catch (err) {
          console.error(`Failed to save product: ${err.message}`);
        }
      }
      res.status(200).json({ message: "Data scraped and saved", products });
      console.log(`Scraped ${products.length} products from ${site}`);
    } catch (error) {
      console.error(`Error scraping ${site}: ${error.message}`);
      res.status(500).json({ message: "Error scraping data", error });
    }
  } else {
    console.log("Scraping data from multiple sites");
    try {
      const scraperApiKey = "8dcef76ad04710bd64b4362e9ded6185";

      const siteConfigs = [
        walmartConfig,
        amazonUSConfig,
        bestBuyConfig,
        aliExpressConfig,
      ];
      const products = [];

      for (const config of siteConfigs) {
        try {
          console.log(`Scraping ${config.siteName}...`);
          const siteResults = await scrapeWebsite(
            config.url,
            config,
            scraperApiKey
          );
          products.push(...siteResults);
        } catch (error) {
          console.error(`Error scraping ${config.siteName}: ${error.message}`);
        }
      }

      // Save to MongoDB
      for (const product of products) {
        try {
          await Product.create(product);
        } catch (err) {
          console.error(`Failed to save product: ${err.message}`);
        }
      }

      res.status(200).json({ message: "Scraping completed!", products });
    } catch (error) {
      console.error(`Error scraping data: ${error.message}`);
      res.status(500).json({ message: "Error scraping data", error });
    }
  }
});

// const axios = require('axios');
// const cheerio = require('cheerio');
// const walmartConfig = {
//   siteName: "Walmart",
//   url: "https://www.walmart.com/search/?query=laptop",
//   containerSelector: "div.search-result-gridview-item",
//   nameSelector: "a.product-title-link > span",
//   priceSelector: "span.price-main > span.visuallyhidden",
//   ratingSelector: "span.stars-reviews-count > span",
//   reviewsSelector: "span.stars-reviews-count > span",
//   vendorSelector: "div.sold-by > span",
//   discountSelector: "", // Walmart typically doesn't show explicit discounts
// };
// // const amazonUSConfig = {
// //   siteName: "Amazon US",
// //   url: "https://www.amazon.com/s?k=laptop",
// //   containerSelector: "div.s-main-slot > div.s-result-item",
// //   nameSelector: "h2.a-size-mini > a",
// //   priceSelector: "span.a-price > span.a-offscreen",
// //   ratingSelector: "span.a-icon-alt",
// //   reviewsSelector: "span.a-size-base",
// //   vendorSelector: "", // Not available on listing pages
// //   discountSelector: "", // Not available on listing pages
// // };

// const amazonUSConfig = {
//   siteName: "Amazon",
//   url: "https://www.amazon.com/s?k=laptop",
//   containerSelector: "div.s-main-slot > div.s-result-item",

//   // Updated Selectors
//   nameSelector: "h2.a-size-mini > a > span", // Target the inner span for product name
//   priceSelector: "span.a-price > span.a-offscreen", // Scrape displayed price
//   originalPriceSelector: "span.a-price.a-text-price > span.a-offscreen", // For original price (if discounted)
//   ratingSelector: "span.a-icon-alt", // Extract star ratings
//   reviewsSelector: "span.a-size-base", // Extract the number of reviews
//   vendorSelector: "span.s-line-clamp-1 > a", // Vendor or brand name (if available)
//   discountSelector: "", // Amazon doesn't provide explicit discounts; calculate using price and original price
//   availabilitySelector: "span.a-size-small.a-color-base", // Stock/availability details
//   badgeSelector: "span.s-badge-text", // Extract badges like "Amazon's Choice" or "Best Seller"
//   imageSelector: "img.s-image", // Extract product image URL for visual analysis
// };

const walmartConfig = {
  siteName: "Walmart",
  url: "https://www.walmart.com/search/?query=laptop",
  containerSelector: "div.search-result-gridview-item",
  nameSelector: "a.product-title-link > span",
  priceSelector: "span.price-main > span.visuallyhidden",
  ratingSelector: "span.stars-reviews-count > span",
  reviewsSelector: "span.stars-reviews-count > span",
  vendorSelector: "div.sold-by > span",
  paginationParam: "&page=", // Pagination logic
  render: false, // No need to render JS
};

const amazonUSConfig = {
  siteName: "Amazon",
  url: "https://www.amazon.com/s?k=laptop",
  containerSelector: "div.s-main-slot > div.s-result-item",
  nameSelector: "h2.a-size-mini > a > span",
  priceSelector: "span.a-price > span.a-offscreen",
  originalPriceSelector: "span.a-price.a-text-price > span.a-offscreen",
  ratingSelector: "span.a-icon-alt",
  reviewsSelector: "span.a-size-base",
  vendorSelector: "span.s-line-clamp-1 > a",
  paginationParam: "&page=", // Pagination logic
  render: true, // Needs JS rendering
};


const bestBuyConfig = {
  siteName: "Best Buy",
  url: "https://www.bestbuy.com/site/searchpage.jsp?st=laptop",
  containerSelector: "div.sku-item",
  nameSelector: "h4.sku-header > a",
  priceSelector: "div.priceView-customer-price > span",
  ratingSelector: "div.c-ratings-reviews-v4 > p > span.c-reviews > span",
  reviewsSelector: "div.c-ratings-reviews-v4 > p > span.c-reviews",
  vendorSelector: "", // Best Buy is the sole vendor
  discountSelector: "", // Not explicitly shown
};
const aliExpressConfig = {
  siteName: "AliExpress",
  url: "https://www.aliexpress.com/wholesale?SearchText=laptop",
  containerSelector: "div.JIIxO",
  nameSelector: "a._3t7zg > h1",
  priceSelector: "span._12A8D > span",
  ratingSelector: "span.eXPaM > span",
  reviewsSelector: "span.eXPaM > span:nth-child(2)",
  vendorSelector: "a._18_85 > span",
  discountSelector: "span.mOx4j",
};
const scrapeSites = async (req, res) => {
  const scraperApiKey = "8dcef76ad04710bd64b4362e9ded6185";

  const siteConfigs = [
    walmartConfig,
    amazonUSConfig,
    bestBuyConfig,
    aliExpressConfig,
  ];
  const products = [];

  for (const config of siteConfigs) {
    console.log(`Scraping ${config.siteName}...`);
    const siteResults = await scrapeWebsite(config.url, config, scraperApiKey);
    products.push(...siteResults);
  }

  // Save to MongoDB
  for (const product of products) {
    try {
      await Product.create(product);
    } catch (err) {
      console.error(`Failed to save product: ${err.message}`);
    }
  }

  res.status(200).json({ message: "Scraping completed!", products });
};

app.get("/api/scrape-all", scrapeSites);

// const scrapeWebsite = async (url, siteConfig, scraperApiKey) => {
//   try {
//     // const response = await axios.get("http://api.scraperapi.com", {
//     //   params: {
//     //     api_key: scraperApiKey,
//     //     url,
//     //   },
//     // });

//     // const $ = cheerio.load(response.data);
//     const headers = {
//       "User-Agent":
//         "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
//       "Accept-Language": "en-US,en;q=0.9",
//       "Accept-Encoding": "gzip, deflate, br",
//       Connection: "keep-alive",
//     };
    
//     const receivedSite = siteConfig.siteName;
//     const products = [];
    
//     for (let page = 1; page <= 5; page++) {
//       // const url = `https://www.amazon.com/s?k=laptop&page=${page}`;
//       const proxyUrl =
//       `http://api.scraperapi.com?api_key=8dcef76ad04710bd64b4362e9ded6185&url=` +
//       url+"&page="+page;
//       // Scrape data for this URL
//       const { data } = await axios.get(proxyUrl);
//     const $ = cheerio.load(data);
//     $("div.s-main-slot > div.s-result-item").each((_, element) => {
//       const name = $(element).find("h2.a-size-mini > a.a-link-normal").text().trim();
//       const price = $(element).find("span.a-price > span.a-offscreen").text().trim();
//       const originalPrice = $(element).find("span.a-price.a-text-price > span.a-offscreen").text().trim();
//       const description = $(element).find("div.a-row.a-size-base.a-color-secondary").text().trim();
//       const discount = $(element).find("span.savingsPercentage").text().trim();
//       const vendor = $(element).find("span.a-size-base-plus.a-color-base").text().trim();
//       const rating = $(element).find("span.a-icon-alt").text().trim();
//       const reviews = $(element).find("span.a-size-small > span.a-size-base").text().trim();
//       const availability = $(element).find("span.a-size-small.a-color-base").text().trim();
//       const badge = $(element).find("span.s-badge-text").text().trim();
//       const image = $(element).find("img.s-image").attr("src");
//       products.push({ name, price, originalPrice, description, discount, vendor, rating, reviews, availability, badge, image });
//     });
//     }

//     // $(siteConfig.containerSelector).each((index, element) => {
//     //   const name = $(element).find(siteConfig.nameSelector).text().trim();
//     //   const price = $(element).find(siteConfig.priceSelector).text().trim();
//     //   const rating = $(element).find(siteConfig.ratingSelector).text().trim();
//     //   const reviews = $(element).find(siteConfig.reviewsSelector).text().trim();
//     //   const vendor = $(element).find(siteConfig.vendorSelector).text().trim();
//     //   const discount = $(element)
//     //     .find(siteConfig.discountSelector)
//     //     .text()
//     //     .trim();

//     //   if (name && price) {
//     //     products.push({
//     //       name,
//     //       price,
//     //       rating,
//     //       reviews,
//     //       vendor,
//     //       discount,
//     //       site: siteConfig.siteName,
//     //     });
//     //   }
//     // });
//     return products;
//   } catch (error) {
//     console.error(`Error scraping ${siteConfig.siteName}: ${error.message}`);
//     return [];
//   }
// };
// const scrapeWebsite = async (url, siteConfig, scraperApiKey) => {
//   const products = [];
//   const maxRetries = 5;

//   for (let page = 1; page <= 5; page++) {
//     const proxyUrl = `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${url}&render=true&proxy_type=residential&page=${page}`;

//     for (let attempt = 1; attempt <= maxRetries; attempt++) {
//       try {
//         const { data } = await axios.get(proxyUrl);
//         const $ = cheerio.load(data);

//         $("div.s-main-slot > div.s-result-item").each((_, element) => {
//           const name = $(element).find("h2.a-size-mini > a.a-link-normal").text().trim();
//           const price = $(element).find("span.a-price > span.a-offscreen").text().trim();
//           const originalPrice = $(element).find("span.a-price.a-text-price > span.a-offscreen").text().trim();
//           const description = $(element).find("div.a-row.a-size-base.a-color-secondary").text().trim();
//           const discount = $(element).find("span.savingsPercentage").text().trim();
//           const vendor = $(element).find("span.a-size-base-plus.a-color-base").text().trim();
//           const rating = $(element).find("span.a-icon-alt").text().trim();
//           const reviews = $(element).find("span.a-size-small > span.a-size-base").text().trim();
//           const availability = $(element).find("span.a-size-small.a-color-base").text().trim();
//           const badge = $(element).find("span.s-badge-text").text().trim();
//           const image = $(element).find("img.s-image").attr("src");
//           products.push({ name, price, originalPrice, description, discount, vendor, rating, reviews, availability, badge, image });
//         });

//         break; // Break out of the retry loop if the request is successful
//       } catch (error) {
//         if (attempt === maxRetries) {
//           console.error(`Failed to scrape ${url} after ${maxRetries} attempts: ${error.message}`);
//         } else {
//           console.error(`Error scraping ${url} (attempt ${attempt}): ${error.message}`);
//           await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt))); // Exponential backoff
//         }
//       }
//     }
//   }

//   return products;
// };

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  // Add more User-Agents
];

const getRandomUserAgent = () => userAgents[Math.floor(Math.random() * userAgents.length)];


const scrapeWebsite = async (url, siteConfig, scraperApiKey) => {
  const products = [];
  const maxRetries = 5;

  for (let page = 1; page <= 5; page++) {
    const paginatedUrl = `${url}&page=${page}`; // Pagination logic
    const proxyUrl = `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(
      paginatedUrl
    )}&render=${siteConfig.render || "false"}`;


    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // headers: { "User-Agent": getRandomUserAgent() },
        console.log("Final URL being scraped : ", proxyUrl);
        const { data } = await axios.get(proxyUrl, { headers: getRandomUserAgent() || {} });
        const $ = cheerio.load(data);

        $(siteConfig.containerSelector).each((_, element) => {
          const name = $(element).find(siteConfig.nameSelector).text().trim();
          const price = $(element).find(siteConfig.priceSelector).text().trim();
          const originalPrice = $(element).find(siteConfig.originalPriceSelector || "").text().trim();
          const description = $(element).find(siteConfig.descriptionSelector || "").text().trim();
          const discount = $(element).find(siteConfig.discountSelector || "").text().trim();
          const vendor = $(element).find(siteConfig.vendorSelector || "").text().trim();
          const rating = $(element).find(siteConfig.ratingSelector || "").text().trim();
          const reviews = $(element).find(siteConfig.reviewsSelector || "").text().trim();
          const availability = $(element).find(siteConfig.availabilitySelector || "").text().trim();
          const badge = $(element).find(siteConfig.badgeSelector || "").text().trim();
          const image = $(element).find(siteConfig.imageSelector || "").attr("src");

          if (name && price) {
            products.push({
              name,
              price,
              originalPrice,
              description,
              discount,
              vendor,
              rating,
              reviews,
              availability,
              badge,
              image,
              site: siteConfig.siteName,
              scrapedAt: new Date(),
            });
          }
        });

        break; // Exit retry loop on success
      } catch (error) {
        if (attempt === maxRetries) {
          console.error(`Failed to scrape ${url} after ${maxRetries} attempts: ${error.message}`);
        } else {
          console.error(`Retrying ${url} (attempt ${attempt}): ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt))); // Exponential backoff
        }
      }
    }
  }

  return products;
};
// Puppeteer launch with ScraperAPI proxy
const launchBrowser = async (url) => {
  return puppeteer.launch({
    headless: true,
    args: [
      `--proxy-server=`+url, // Replace with ScraperAPI's proxy URL
    ],
  });
};

// Function to scrape Walmart
const scrapeWalmart = async (proxyUrl) => {
  const browser = await launchBrowser(proxyUrl);
  const page = await browser.newPage();

  try {
    // Use ScraperAPI to handle dynamic content
    const scraperApiUrl = proxyUrl+"&render=true";

    await page.goto(scraperApiUrl, { waitUntil: 'networkidle2' });

    // Wait for products to load
    await page.waitForSelector(walmartConfig.containerSelector);

    // Extract product data
    const products = await page.evaluate((config) => {
      const productElements = document.querySelectorAll(config.containerSelector);
      const extractedProducts = [];

      productElements.forEach((product) => {
        const name = product.querySelector(config.nameSelector)?.innerText.trim() || null;
        const price = product.querySelector(config.priceSelector)?.innerText.trim() || null;
        const rating = product.querySelector(config.ratingSelector)?.innerText.trim() || null;
        const reviews = product.querySelector(config.reviewsSelector)?.innerText.trim() || null;
        const image = product.querySelector(config.imageSelector)?.getAttribute('src') || null;

        extractedProducts.push({
          name,
          price,
          rating,
          reviews,
          image,
        });
      });

      return extractedProducts;
    }, walmartConfig);

    console.log("Scraped Products:", products);

    // Optionally, save the data to a file or database
    // fs.writeFileSync('walmart_products.json', JSON.stringify(products, null, 2));

  } catch (error) {
    console.error("Error during scraping:", error.message);
  } finally {
    await browser.close();
  }
};
// const scrapeWalmart = async (scraperApiKey) => {
//   const walmartConfig = {
//     siteName: "Walmart",
//     url: "https://www.walmart.com/search/?query=laptop",
//     containerSelector: "div.search-result-gridview-item",
//     nameSelector: "a.product-title-link > span",
//     priceSelector: "span.price-main > span.visuallyhidden",
//     originalPriceSelector: "span.price-main > span.strike-through",
//     ratingSelector: "span.stars-reviews-count > span",
//     reviewsSelector: "span.stars-reviews-count > span:last-child",
//     vendorSelector: "div.sold-by > span",
//     badgeSelector: "div.badge > span",
//     imageSelector: "div.search-result-productimage img",
//     availabilitySelector: "div.search-result-availability",
//     paginationParam: "&page=",
//   };

//   const products = [];
//   for (let page = 1; page <= 5; page++) {
//     const url = `${walmartConfig.url}${walmartConfig.paginationParam}${page}`;
//     const proxyUrl = `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(
//       url
//     )}&render=${walmartConfig.render}`;

//     try {
//       const { data } = await axios.get(proxyUrl);
//       const $ = cheerio.load(data);

//       $(walmartConfig.containerSelector).each((_, element) => {
//         const name = $(element).find(walmartConfig.nameSelector).text().trim();
//         const price = $(element).find(walmartConfig.priceSelector).text().trim();
//         const originalPrice = $(element)
//           .find(walmartConfig.originalPriceSelector)
//           .text()
//           .trim();
//         const rating = $(element).find(walmartConfig.ratingSelector).text().trim();
//         const reviews = $(element).find(walmartConfig.reviewsSelector).text().trim();
//         const vendor = $(element).find(walmartConfig.vendorSelector).text().trim();
//         const badge = $(element).find(walmartConfig.badgeSelector).text().trim();
//         const image = $(element).find(walmartConfig.imageSelector).attr("src");
//         const availability = $(element).find(walmartConfig.availabilitySelector).text().trim();

//         if (name && price) {
//           products.push({
//             name,
//             price,
//             originalPrice,
//             rating,
//             reviews,
//             vendor,
//             badge,
//             image,
//             availability,
//             site: walmartConfig.siteName,
//           });
//         }
//       });
//     } catch (error) {
//       console.error(`Error scraping Walmart (page ${page}): ${error.message}`);
//     }
//   }
//   return products;
// };




const comparePrices = async () => {
  const products = await Product.find();

  const groupedByName = products.reduce((acc, product) => {
    acc[product.name] = acc[product.name] || [];
    acc[product.name].push({ site: product.site, price: product.price });
    return acc;
  }, {});

  return Object.entries(groupedByName).map(([name, prices]) => ({
    name,
    prices,
  }));
};
const generatePriceComparisonChart = async () => {
  const priceComparison = await comparePrices();

  const chartData = {
    labels: priceComparison.map((item) => item.name),
    datasets: priceComparison.map((item, index) => ({
      label: `Site ${index + 1}`,
      data: item.prices.map((price) => price.price),
      borderColor: `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${
        Math.random() * 255
      }, 1)`,
      fill: false,
    })),
  };

  const chartConfig = {
    type: "line",
    data: chartData,
    options: {
      plugins: {
        title: {
          display: true,
          text: "Price Comparison Across Sites",
        },
      },
    },
  };

  return await chartJSNodeCanvas.renderToBuffer(chartConfig);
};
app.get("/api/price-comparison-chart", async (req, res) => {
  const chart = await generatePriceComparisonChart();
  res.set("Content-Type", "image/png");
  res.send(chart);
});

// New GET endpoint for fetching all products
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Error fetching products', error });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
