const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env' });

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pinger';

// --- Schema & Model ---
const configSchema = new mongoose.Schema({
  _id: { type: String, default: 'appConfig' },
  urls: { type: [String], default: [] },
  pingInterval: { type: Number, default: 10 * 60 * 1000 }
});
const Config = mongoose.model('Config', configSchema);

// --- Connect to Database ---
async function connectToDatabase() {
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
    return true;
  } catch (err) {
    console.error('MongoDB connection failed:', err);
    return false;
  }
}

// --- Default Config ---
const defaultConfig = () => ({
  urls: process.env.URLS?.split(',') || [],
  pingInterval: +process.env.PING_INTERVAL * 60_000 || 600_000,
});

// --- Load Config ---
async function loadConfiguration() {
  try {
    const config = await Config.findById('appConfig');
    return config || defaultConfig();
  } catch (err) {
    console.error('Error loading config:', err);
    return defaultConfig();
  }
}

// --- Save Config ---
async function saveConfiguration(urls, pingInterval) {
  try {
    await Config.findByIdAndUpdate(
      'appConfig',
      { urls, pingInterval },
      { upsert: true, new: true }
    );
    return true;
  } catch (err) {
    console.error('Error saving config:', err);
    return false;
  }
}

module.exports = { connectToDatabase, loadConfiguration, saveConfiguration };