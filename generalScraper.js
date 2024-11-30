// const axios = require('axios');
// const cheerio = require('cheerio');
const walmartConfig = {
    siteName: 'Walmart',
    containerSelector: 'div.search-result-gridview-item',
    nameSelector: 'a.product-title-link > span',
    priceSelector: 'span.price-main > span.visuallyhidden',
    ratingSelector: 'span.stars-reviews-count > span',
    reviewsSelector: 'span.stars-reviews-count > span',
    vendorSelector: 'div.sold-by > span',
    discountSelector: '', // Walmart typically doesn't show explicit discounts
  };
  const amazonUSConfig = {
    siteName: 'Amazon US',
    containerSelector: 'div.s-main-slot > div.s-result-item',
    nameSelector: 'h2.a-size-mini > a',
    priceSelector: 'span.a-price > span.a-offscreen',
    ratingSelector: 'span.a-icon-alt',
    reviewsSelector: 'span.a-size-base',
    vendorSelector: '', // Not available on listing pages
    discountSelector: '', // Not available on listing pages
  };
  const bestBuyConfig = {
    siteName: 'Best Buy',
    containerSelector: 'div.sku-item',
    nameSelector: 'h4.sku-header > a',
    priceSelector: 'div.priceView-customer-price > span',
    ratingSelector: 'div.c-ratings-reviews-v4 > p > span.c-reviews > span',
    reviewsSelector: 'div.c-ratings-reviews-v4 > p > span.c-reviews',
    vendorSelector: '', // Best Buy is the sole vendor
    discountSelector: '', // Not explicitly shown
  };
  const aliExpressConfig = {
    siteName: 'AliExpress',
    containerSelector: 'div.JIIxO',
    nameSelector: 'a._3t7zg > h1',
    priceSelector: 'span._12A8D > span',
    ratingSelector: 'span.eXPaM > span',
    reviewsSelector: 'span.eXPaM > span:nth-child(2)',
    vendorSelector: 'a._18_85 > span',
    discountSelector: 'span.mOx4j',
  };
  const scrapeSites = async (req, res) => {
    const scraperApiKey = '8dcef76ad04710bd64b4362e9ded6185';
  
    const siteConfigs = [walmartConfig, amazonUSConfig, bestBuyConfig, aliExpressConfig];
    const results = [];
  
    for (const config of siteConfigs) {
      console.log(`Scraping ${config.siteName}...`);
      const siteResults = await scrapeWebsite(config.url, config, scraperApiKey);
      results.push(...siteResults);
    }
  
    // Save to MongoDB
    for (const product of results) {
      try {
        await Product.create(product);
      } catch (err) {
        console.error(`Failed to save product: ${err.message}`);
      }
    }
  
    res.status(200).json({ message: 'Scraping completed!', results });
  };
  
  app.get('/api/scrape-all', scrapeSites);
          

const scrapeWebsite = async (url, siteConfig, scraperApiKey) => {
  try {
    const response = await axios.get('http://api.scraperapi.com', {
      params: {
        api_key: scraperApiKey,
        url,
      },
    });

    const $ = cheerio.load(response.data);
    const products = [];

    $(siteConfig.containerSelector).each((index, element) => {
      const name = $(element).find(siteConfig.nameSelector).text().trim();
      const price = $(element).find(siteConfig.priceSelector).text().trim();
      const rating = $(element).find(siteConfig.ratingSelector).text().trim();
      const reviews = $(element).find(siteConfig.reviewsSelector).text().trim();
      const vendor = $(element).find(siteConfig.vendorSelector).text().trim();
      const discount = $(element).find(siteConfig.discountSelector).text().trim();

      if (name && price) {
        products.push({
          name,
          price,
          rating,
          reviews,
          vendor,
          discount,
          site: siteConfig.siteName,
        });
      }
    });

    return products;
  } catch (error) {
    console.error(`Error scraping ${siteConfig.siteName}: ${error.message}`);
    return [];
  }
};

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
        borderColor: `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 1)`,
        fill: false,
      })),
    };
  
    const chartConfig = {
      type: 'line',
      data: chartData,
      options: {
        plugins: {
          title: {
            display: true,
            text: 'Price Comparison Across Sites',
          },
        },
      },
    };
  
    return await chartJSNodeCanvas.renderToBuffer(chartConfig);
  };
  app.get('/api/price-comparison-chart', async (req, res) => {
    const chart = await generatePriceComparisonChart();
    res.set('Content-Type', 'image/png');
    res.send(chart);
  });
      