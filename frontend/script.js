const container = document.getElementById('cards');
const settingsModal = document.getElementById('settings-modal');
const urlList = document.getElementById('url-list');
const intervalInput = document.getElementById('interval-input');
const currentInterval = document.getElementById('current-interval');
const pingStatus = document.getElementById('ping-status');

// Store the interval ID so we can clear it when needed
let refreshIntervalId = null;

async function loadStatus() {
  try {
    const res = await fetch('/status');
    const data = await res.json();

    container.innerHTML = '';

    data.stats.forEach(stat => {
      const card = document.createElement('div');

      // Handle case where lastStatus might be undefined
      const lastStatus = stat.lastStatus || {};
      const status = lastStatus.status || 'UNKNOWN';
      const responseTime = lastStatus.responseTime || '-';
      const time = lastStatus.time ? new Date(lastStatus.time).toLocaleString() : 'Never';

      card.innerHTML = `
        <div class="status-card">
          <div class="card-header">
            ${stat.url}
          </div>
          <div class="card-body">
            <div class="metric-row">
              <span class="metric-label">Status:</span>
              <span class="status-indicator ${status === 'DOWN' ? 'status-down' : 'status-up'}">
                ${status}
              </span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Response Time:</span>
              <span class="metric-value response-time">${responseTime} ms</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Last Checked:</span>
              <span class="metric-value last-checked">${time}</span>
            </div>
          </div>
        </div>
        `;
      container.appendChild(card);
    });
    
    // Update ping status indicator
    if (data.isPinging) {
      pingStatus.textContent = 'Active';
      pingStatus.className = 'status-badge active';
    } else {
      pingStatus.textContent = 'Inactive';
      pingStatus.className = 'status-badge inactive';
    }
  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger" role="alert">Error fetching status: ${err.message}</div>`;
  }
}

// Settings functions
function openSettings() {
  settingsModal.classList.add('active');
  loadSettings();
}

function closeSettings() {
  settingsModal.classList.remove('active');
}

async function loadSettings() {
  try {
    const res = await fetch('/config');
    const config = await res.json();
    
    intervalInput.value = config.pingInterval / 60 / 1000;
    currentInterval.textContent = config.pingInterval / 60 / 1000;
    
    renderUrlList(config.urls);
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

function renderUrlList(urls) {
  urlList.innerHTML = '';
  
  urls.forEach(url => {
    const urlItem = document.createElement('div');
    urlItem.className = 'url-item';
    urlItem.innerHTML = `
      <div class="url-text">${url}</div>
      <div class="url-actions">
        <button class="btn btn-danger btn-sm" onclick="removeUrl('${encodeURIComponent(url)}')">Remove</button>
      </div>
    `;
    urlList.appendChild(urlItem);
  });
}

async function updateInterval() {
  const minutes = parseInt(intervalInput.value);
  if (isNaN(minutes) || minutes < 1) {
    alert('Please enter a valid number (minimum 1)');
    return;
  }
  
  try {
    const res = await fetch(`/config/interval/${minutes}`, {
      method: 'POST'
    });
    const result = await res.json();
    
    if (result.success) {
      currentInterval.textContent = minutes;
      
      // Refresh the dashboard once after updating interval
      await loadStatus();
      
      alert('Ping interval updated successfully');
    } else {
      alert('Error updating ping interval');
    }
  } catch (err) {
    console.error('Error updating interval:', err);
    alert('Error updating ping interval');
  }
}

async function addUrl() {
  const urlInput = document.getElementById('url-input');
  const url = urlInput.value.trim();
  
  if (!url) {
    alert('Please enter a URL');
    return;
  }
  
  try {
    const res = await fetch('/urls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });
    const result = await res.json();
    
    if (result.success) {
      urlInput.value = '';
      renderUrlList(result.urls);
      
      // Refresh the dashboard once after adding URL
      await loadStatus();
      
      alert('URL added successfully');
    } else {
      alert('Error adding URL');
    }
  } catch (err) {
    console.error('Error adding URL:', err);
    alert('Error adding URL');
  }
}

async function removeUrl(url) {
  try {
    const res = await fetch(`/urls/${url}`, {
      method: 'DELETE'
    });
    const result = await res.json();
    
    if (result.success) {
      renderUrlList(result.urls);
      
      // Refresh the dashboard once after removing URL
      await loadStatus();
      
      alert('URL removed successfully');
    } else {
      alert('Error removing URL');
    }
  } catch (err) {
    console.error('Error removing URL:', err);
    alert('Error removing URL');
  }
}

// Clear existing interval and set up new one
function setupRefreshInterval() {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
  }
  refreshIntervalId = setInterval(loadStatus, 30000);
}

// Initial load + refresh every 30 seconds
loadStatus();
setupRefreshInterval();