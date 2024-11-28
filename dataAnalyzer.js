const mongoose = require('mongoose');

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/ecommerce_data', { useNewUrlParser: true, useUnifiedTopology: true });

const productSchema = new mongoose.Schema({
  name: String,
  price: String,
  description: String,
  discount: String,
  vendors: [String],
  url: String,
  scrapedAt: Date,
});

const Product = mongoose.model('Product', productSchema);

// Fetch Data
const fetchProducts = async () => {
  try {
    const products = await Product.find(); // Fetch all products
    console.log(products);
    return products;
  } catch (error) {
    console.error('Error fetching products:', error.message);
  }
};

fetchProducts();
