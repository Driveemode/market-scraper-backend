// database/mongoConfig.js
const mongoose = require('mongoose');

const ScrapedDataSchema = new mongoose.Schema({
    url: String,
    data: Object,
    scrapedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('ScrapedData', ScrapedDataSchema);
