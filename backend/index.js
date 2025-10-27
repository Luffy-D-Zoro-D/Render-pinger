const express = require('express');
const axios = require('axios');
const path = require('path');
const db = require('./db');
require('dotenv').config({ path: __dirname + '/.env' });

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 8080;

let URLS = [];
let PING_INTERVAL = 10 * 60 * 1000; // Default 10 minutes
const FRONTEND_DIR = path.join(__dirname, '../frontend');

// Store current status information in memory only
let urlStatuses = {};
let pingIntervalId = null;
let isPinging = true;

// Initialize status for all URLs
const initializeUrlStatuses = () => {
  URLS.forEach(url => {
    urlStatuses[url] = {
      status: 'UNKNOWN',
      responseTime: null,
      time: new Date().toISOString()
    };
  });
};

// function to ping all URLs
const pingUrls = async () => {
  if (!isPinging) return;
  
  console.log(`\n[${new Date().toISOString()}] Pinging ${URLS.length} URLs...`);

  for (const url of URLS) {
    const start = Date.now();
    try {
      const res = await axios.get(url);
      const time = Date.now() - start;
      
      // Update status in memory
      urlStatuses[url] = {
        status: res.status,
        responseTime: time,
        time: new Date().toISOString()
      };
      
      console.log(`✅ ${url} responded in ${time}ms`);
    } catch (err) {      
      // Update status in memory
      urlStatuses[url] = {
        status: 'DOWN',
        responseTime: null,
        time: new Date().toISOString()
      };
      
      console.error(`❌ ${url} failed: ${err.message}`);
    }
  }
};

// Start pinging
const startPinging = () => {
  pingUrls();
  if (pingIntervalId) clearInterval(pingIntervalId);
  pingIntervalId = setInterval(pingUrls, PING_INTERVAL);
};

// API route for frontend - get status
app.get('/status', (req, res) => {
  const stats = URLS.map(url => {
    return { 
      url, 
      lastStatus: urlStatuses[url] || {
        status: 'UNKNOWN',
        responseTime: null,
        time: new Date().toISOString()
      }
    };
  });
  res.json({ monitored: URLS.length, stats, isPinging, pingInterval: PING_INTERVAL });
});

// API route - get configuration
app.get('/config', (req, res) => {
  res.json({ urls: URLS, pingInterval: PING_INTERVAL, isPinging });
});

// API route - update ping interval
app.post('/config/interval/:minutes', async (req, res) => {
  const minutes = parseInt(req.params.minutes);
  if (isNaN(minutes) || minutes < 1) {
    return res.status(400).json({ error: 'Invalid interval value' });
  }
  
  PING_INTERVAL = minutes * 60 * 1000;
  
  // Save to database
  await db.saveConfiguration(URLS, PING_INTERVAL);
  
  // Restart pinging with new interval
  startPinging();
  
  res.json({ success: true, pingInterval: PING_INTERVAL });
});

// API route - add URL
app.post('/urls', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  if (!URLS.includes(url)) {
    URLS.push(url);
    urlStatuses[url] = {
      status: 'UNKNOWN',
      responseTime: null,
      time: new Date().toISOString()
    };
    
    // Save to database
    await db.saveConfiguration(URLS, PING_INTERVAL);
  }
  
  res.json({ success: true, urls: URLS });
});

// API route - remove URL
app.delete('/urls/:url', async (req, res) => {
  const urlToRemove = decodeURIComponent(req.params.url);
  URLS = URLS.filter(url => url !== urlToRemove);
  delete urlStatuses[urlToRemove];
  
  // Save to database
  await db.saveConfiguration(URLS, PING_INTERVAL);
  
  res.json({ success: true, urls: URLS });
});

// API route - toggle pinging
app.post('/config/toggle-ping', (req, res) => {
  isPinging = !isPinging;
  res.json({ success: true, isPinging });
});

// serve frontend
app.use(express.static(FRONTEND_DIR));

// Initialize and start server
db.connectToDatabase().then(async (connected) => {
  if (connected) {
    const config = await db.loadConfiguration();
    URLS = config.urls;
    PING_INTERVAL = config.pingInterval;
  } else {
    // Fallback to environment variables
    URLS = process.env.URLS?.split(',') || [];
    PING_INTERVAL = parseInt(process.env.PING_INTERVAL || '10') * 60 * 1000;
  }
  
  initializeUrlStatuses();
  startPinging();
  
  app.listen(PORT, () =>{
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    // Shut down after 5 minutes (300,000 ms)
  setTimeout(() => {
    console.log('🕒 5 minutes elapsed — shutting down gracefully...');
    process.exit(0);
  }, 5000);
  } )
});
