const mineflayer = require('mineflayer');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');

const HTTP_PORT = process.env.PORT || 10000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const JUMP_INTERVAL = 20000; // 20 seconds
const RECONNECT_DELAY = 10000; // 10 seconds
const DATA_FILE = path.join(__dirname, 'bots-data.json');
const SERVERS_HISTORY_FILE = path.join(__dirname, 'servers-history.json');
const MONITOR_SERVICES = process.env.MONITOR_SERVICES ? process.env.MONITOR_SERVICES.split(',') : [];

// In-memory bot storage
let bots = new Map();
let botData = {};
let serversHistory = [];

// Load bot data from file
function loadBotData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      botData = JSON.parse(data);
      console.log(`[${new Date().toLocaleTimeString()}] Loaded ${Object.keys(botData).length} bots from storage`);
    }
  } catch (err) {
    console.log(`[${new Date().toLocaleTimeString()}] Error loading bot data: ${err.message}`);
    botData = {};
  }
}

// Save bot data to file
function saveBotData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(botData, null, 2));
  } catch (err) {
    console.log(`[${new Date().toLocaleTimeString()}] Error saving bot data: ${err.message}`);
  }
}

// Load servers history from file
function loadServersHistory() {
  try {
    if (fs.existsSync(SERVERS_HISTORY_FILE)) {
      const data = fs.readFileSync(SERVERS_HISTORY_FILE, 'utf8');
      serversHistory = JSON.parse(data);
      console.log(`[${new Date().toLocaleTimeString()}] Loaded ${serversHistory.length} servers from history`);
    }
  } catch (err) {
    console.log(`[${new Date().toLocaleTimeString()}] Error loading servers history: ${err.message}`);
    serversHistory = [];
  }
}

// Save servers history to file
function saveServersHistory() {
  try {
    fs.writeFileSync(SERVERS_HISTORY_FILE, JSON.stringify(serversHistory, null, 2));
  } catch (err) {
    console.log(`[${new Date().toLocaleTimeString()}] Error saving servers history: ${err.message}`);
  }
}

// Add server to history
function addServerToHistory(serverHost, serverPort, version, username) {
  const serverKey = `${serverHost}:${serverPort}`;
  
  // Check if server already exists
  const existingIndex = serversHistory.findIndex(s => s.key === serverKey);
  
  const serverEntry = {
    key: serverKey,
    host: serverHost,
    port: serverPort,
    version: version || null,
    username: username || null,
    lastUsed: new Date().toISOString(),
    useCount: existingIndex >= 0 ? serversHistory[existingIndex].useCount + 1 : 1
  };
  
  if (existingIndex >= 0) {
    // Update existing entry
    serversHistory[existingIndex] = serverEntry;
  } else {
    // Add new entry
    serversHistory.push(serverEntry);
  }
  
  // Sort by last used (most recent first)
  serversHistory.sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));
  
  // Keep only last 100 servers
  if (serversHistory.length > 100) {
    serversHistory = serversHistory.slice(0, 100);
  }
  
  saveServersHistory();
  return serverEntry;
}

// Export servers history to CSV
function exportServersHistoryToCSV() {
  const headers = ['Host', 'Port', 'Version', 'Username', 'Last Used', 'Use Count'];
  const rows = serversHistory.map(server => [
    server.host,
    server.port,
    server.version || '',
    server.username || '',
    server.lastUsed,
    server.useCount
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  return csvContent;
}

// Import servers history from CSV
function importServersHistoryFromCSV(csvContent) {
  try {
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) return { success: false, message: 'CSV file is empty or invalid' };
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const imported = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      if (values.length < 2) continue;
      
      const hostIndex = headers.indexOf('Host');
      const portIndex = headers.indexOf('Port');
      const versionIndex = headers.indexOf('Version');
      const usernameIndex = headers.indexOf('Username');
      
      if (hostIndex >= 0 && portIndex >= 0) {
        const host = values[hostIndex] || '';
        const port = parseInt(values[portIndex]) || 25565;
        const version = versionIndex >= 0 ? (values[versionIndex] || null) : null;
        const username = usernameIndex >= 0 ? (values[usernameIndex] || null) : null;
        
        if (host) {
          addServerToHistory(host, port, version, username);
          imported.push({ host, port });
        }
      }
    }
    
    return { success: true, imported: imported.length, message: `Imported ${imported.length} servers` };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// Bot Manager Class
class BotManager {
  constructor(id, config) {
    this.id = id;
    this.name = config.name || `Bot-${id.substring(0, 8)}`;
    this.serverHost = config.serverHost;
    this.serverPort = config.serverPort || 25565;
    this.username = config.username || this.name;
    this.version = config.version || '1.21';
    this.authKey = config.authKey || null; // For future use with cracked servers
    
    this.bot = null;
    this.jumpInterval = null;
    this.isReconnecting = false;
    this.status = 'disconnected';
    this.createdAt = new Date().toISOString();
    this.lastConnected = null;
    this.connectedCount = 0;
    
    // Store in botData
    botData[id] = {
      id,
      name: this.name,
      serverHost: this.serverHost,
      serverPort: this.serverPort,
      username: this.username,
      version: this.version,
      status: this.status,
      createdAt: this.createdAt,
      lastConnected: this.lastConnected,
      connectedCount: this.connectedCount
    };
    saveBotData();
  }

  createBot() {
    if (this.bot || this.isReconnecting) {
      console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Already connecting or connected`);
      return;
    }

    console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] 🔄 Creating bot connection...`);
    console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Server: ${this.serverHost}:${this.serverPort}`);
    console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Username: ${this.username}`);
    console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Version: ${this.version}`);

    try {
      // Try to use version, but if it fails, let mineflayer auto-detect
      const botOptions = {
        host: this.serverHost,
        port: this.serverPort,
        username: this.username,
        viewDistance: 'tiny',
        chatLengthLimit: 100,
        colorsEnabled: false,
        physicsEnabled: true,
        maxCatchupTicks: 2
      };

      // Mineflayer 4.33.0 supports: Minecraft 1.8 to 1.21.8
      // Use version as-is, don't modify it
      if (this.version) {
        botOptions.version = this.version;
        console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Using specified version: ${this.version}`);
      } else {
        console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] No version specified, using auto-detect (recommended)`);
        console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Supported versions: 1.8 to 1.21.8`);
      }

      this.bot = mineflayer.createBot(botOptions);
      this.setupEventHandlers();
      console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Bot instance created, waiting for connection...`);
    } catch (err) {
      console.error(`[${new Date().toLocaleTimeString()}] [${this.name}] ❌ Error creating bot: ${err.message}`);
      console.error(`[${new Date().toLocaleTimeString()}] [${this.name}] Error stack:`, err.stack);
      
      // Try again with common versions if auto-detect fails
      if (err.message.includes('version') || err.message.includes('null') || err.message.includes('Cannot read')) {
        console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] ⚠️ Version error detected`);
        console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] 🔄 Trying common versions: 1.21, 1.20.4, 1.20.1...`);
        
        // Try common versions in order - prioritize 1.21 if original was 1.21
        let versionsToTry = [];
        if (this.version && this.version.startsWith('1.21')) {
          // If user specified 1.21, try 1.21 first, then variants
          versionsToTry = ['1.21', '1.20.6', '1.20.4', '1.20.1'];
        } else {
          // Otherwise try common versions, starting with 1.21
          versionsToTry = ['1.21', '1.20.6', '1.20.4', '1.20.1', '1.19.4'];
        }
        
        // Also try without version (auto-detect) as last resort
        versionsToTry.push(null);
        
        let connected = false;
        
        for (const tryVersion of versionsToTry) {
          try {
            const versionLabel = tryVersion || 'auto-detect';
            console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Trying version: ${versionLabel}...`);
            const fallbackOptions = {
              host: this.serverHost,
              port: this.serverPort,
              username: this.username,
              viewDistance: 'tiny',
              chatLengthLimit: 100,
              colorsEnabled: false,
              physicsEnabled: true,
              maxCatchupTicks: 2
            };
            
            // Only add version if not null (null = auto-detect)
            if (tryVersion !== null) {
              fallbackOptions.version = tryVersion;
            }
            
            this.bot = mineflayer.createBot(fallbackOptions);
            this.setupEventHandlers();
            console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] ✅ Bot instance created with version: ${versionLabel}`);
            connected = true;
            // Update stored version to the one that worked
            if (tryVersion) {
              this.version = tryVersion;
            }
            break;
          } catch (versionErr) {
            const versionLabel = tryVersion || 'auto-detect';
            console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Version ${versionLabel} failed: ${versionErr.message}`);
            continue;
          }
        }
        
        if (!connected) {
          console.error(`[${new Date().toLocaleTimeString()}] [${this.name}] ❌ All version attempts failed`);
          console.error(`[${new Date().toLocaleTimeString()}] [${this.name}] 💡 Please specify the exact Minecraft version in the bot creation form`);
          this.bot = null;
          this.status = 'error';
          this.scheduleReconnect();
          return;
        }
      } else {
        this.bot = null;
        this.status = 'error';
        this.scheduleReconnect();
        return;
      }
    }
  }

  setupEventHandlers() {
    this.bot.on('login', () => {
      console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] ✅ LOGIN SUCCESS - Connected as ${this.bot.username}`);
      this.status = 'connected';
      this.lastConnected = new Date().toISOString();
      this.connectedCount++;
      this.updateBotData();
      this.broadcastStatus();
    });

    this.bot.on('kicked', (reason) => {
      const reasonText = typeof reason === 'string' ? reason : JSON.stringify(reason);
      console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Kicked: ${reasonText}`);
      this.status = 'kicked';
      this.cleanup();
      this.scheduleReconnect();
    });

    this.bot.on('error', (err) => {
      console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Error: ${err.message}`);
      this.status = 'error';
      this.cleanup();
      this.scheduleReconnect();
    });

    this.bot.on('end', () => {
      console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Connection ended`);
      this.status = 'disconnected';
      this.cleanup();
      if (!this.isReconnecting) {
        this.scheduleReconnect();
      }
    });

    this.bot.on('death', () => {
      console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] 💀 DIED - Waiting for respawn...`);
      this.status = 'dead';
      
      // Stop all movement
      if (this.jumpInterval) {
        clearInterval(this.jumpInterval);
        this.jumpInterval = null;
      }
      
      // Clear all control states
      if (this.bot && this.bot.clearControlStates) {
        this.bot.clearControlStates();
      }
      
      // Bot will automatically respawn, spawn event will be triggered
      console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Bot will respawn automatically...`);
    });
    
    // Handle respawn (when bot comes back to life)
    this.bot.on('respawn', () => {
      console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] 🔄 RESPAWN - Bot is coming back to life`);
      this.status = 'respawned';
    });

    this.bot.on('spawn', () => {
      console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] ✅ SPAWN - Bot is in the world`);
      
      // Check if bot is alive - health might not be available immediately, check after a delay
      setTimeout(() => {
        const health = this.bot.health || 0;
        const isAlive = health > 0;
        console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Health: ${health}/20, Alive: ${isAlive}`);
        
        if (!isAlive) {
          console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] 💀 Bot spawned but is DEAD, attempting to respawn...`);
          this.status = 'dead';
          
          // Try to respawn if method is available
          if (this.bot.respawn) {
            try {
              console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Attempting manual respawn...`);
              this.bot.respawn();
            } catch (err) {
              console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Manual respawn failed: ${err.message}`);
            }
          } else {
            // Wait for automatic respawn
            console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Waiting for automatic respawn (5 seconds)...`);
            setTimeout(() => {
              if (this.bot && this.bot.health > 0) {
                console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] ✅ Bot respawned! Health: ${this.bot.health}`);
                this.status = 'connected';
                this.handleRespawnComplete();
              } else {
                console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Still dead, will retry...`);
                // Try respawn again
                if (this.bot.respawn) {
                  try {
                    this.bot.respawn();
                  } catch (err) {
                    // Ignore
                  }
                }
              }
            }, 5000);
          }
          return;
        }
        
        // Bot is alive, continue with normal spawn handling
        this.handleSpawnComplete();
      }, 500);
    });
    
    // Helper method to handle spawn when bot is alive
    this.handleSpawnComplete = () => {
      // Update status if was dead/respawned
      if (this.status === 'dead' || this.status === 'respawned') {
        this.status = 'connected';
        console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] ✅ Bot is alive and ready!`);
      }
      
      // Wait a bit before clearing control states to avoid conflicts
      setTimeout(() => {
        if (this.bot && this.bot.clearControlStates) {
          this.bot.clearControlStates();
          console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Control states cleared`);
        }
      }, 200);
      
      if (this.bot && this.bot.entity && this.bot.entity.position) {
        console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Position: ${this.bot.entity.position.x.toFixed(2)}, ${this.bot.entity.position.y.toFixed(2)}, ${this.bot.entity.position.z.toFixed(2)}`);
        console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] onGround: ${this.bot.entity.onGround}`);
        
        // Check if bot can move
        if (this.bot.entity.canMove !== undefined) {
          console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Bot can move: ${this.bot.entity.canMove}`);
        }
      } else {
        console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] ⚠️ Spawned but entity/position not available yet`);
      }
      
      // Start jumping after a delay to ensure bot is fully spawned and alive
      setTimeout(() => {
        if (this.bot && this.bot.health > 0) {
          this.startJumping();
        } else {
          console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] ⚠️ Cannot start jumping: bot is dead`);
        }
      }, 1000);
    };
    
    // Helper method to handle respawn completion
    this.handleRespawnComplete = () => {
      this.status = 'connected';
      console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] ✅ Respawn complete! Bot is alive and ready!`);
      this.handleSpawnComplete();
    };
    
    // Listen for game state changes
    this.bot.on('game', () => {
      if (this.bot.game) {
        console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Game mode: ${this.bot.game.gameMode}, level: ${this.bot.game.level}`);
      }
    });
  }

  startJumping() {
    if (this.jumpInterval) {
      clearInterval(this.jumpInterval);
      this.jumpInterval = null;
    }

    if (!this.bot || !this.bot.entity) {
      console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Cannot start jumping: bot or entity not available`);
      return;
    }

    console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Starting jump interval (every ${JUMP_INTERVAL/1000}s)`);
    this.jumpInterval = setInterval(() => {
      if (!this.bot || !this.bot.entity) {
        console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Jump interval: bot or entity not available, skipping`);
        return;
      }
      
      try {
        this.bot.setControlState('jump', true);
        setTimeout(() => {
          if (this.bot && this.bot.setControlState) {
            this.bot.setControlState('jump', false);
          }
        }, 200);
        console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Jumped (auto)`);
      } catch (err) {
        console.error(`[${new Date().toLocaleTimeString()}] [${this.name}] Error in jump interval:`, err.message);
      }
    }, JUMP_INTERVAL);
  }

  cleanup() {
    if (this.jumpInterval) {
      clearInterval(this.jumpInterval);
      this.jumpInterval = null;
    }
  }

  scheduleReconnect() {
    if (this.isReconnecting) {
      return;
    }

    this.isReconnecting = true;
    this.status = 'reconnecting';

    if (this.bot) {
      try {
        this.bot.removeAllListeners();
        this.bot.end();
      } catch (e) {
        // Ignore errors
      }
      this.bot = null;
    }
    
    console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Reconnecting in ${RECONNECT_DELAY / 1000} seconds...`);
    setTimeout(() => {
      this.isReconnecting = false;
      console.log(`[${new Date().toLocaleTimeString()}] [${this.name}] Attempting to reconnect...`);
      this.createBot();
    }, RECONNECT_DELAY);
  }

  updateBotData() {
    if (botData[this.id]) {
      botData[this.id].status = this.status;
      botData[this.id].lastConnected = this.lastConnected;
      botData[this.id].connectedCount = this.connectedCount;
      saveBotData();
    }
  }
  
  broadcastStatus() {
    // This will be called by the WebSocket handler
    if (global.broadcastBotStatus) {
      global.broadcastBotStatus(this.id);
    }
  }

  getStatus() {
    if (!this.bot || !this.bot.entity) {
      return {
        id: this.id,
        name: this.name,
        connected: false,
        status: this.status,
        serverHost: this.serverHost,
        serverPort: this.serverPort,
        version: this.version,
        createdAt: this.createdAt,
        lastConnected: this.lastConnected,
        connectedCount: this.connectedCount
      };
    }

    return {
      id: this.id,
      name: this.name,
      connected: true,
      status: this.status,
      username: this.bot.username,
      position: this.bot.entity.position ? {
        x: this.bot.entity.position.x.toFixed(2),
        y: this.bot.entity.position.y.toFixed(2),
        z: this.bot.entity.position.z.toFixed(2)
      } : null,
      health: this.bot.health || 0,
      food: this.bot.food || 0,
      gameMode: this.bot.game ? this.bot.game.gameMode : null,
      ping: this.bot.player ? this.bot.player.ping : null,
      serverHost: this.serverHost,
      serverPort: this.serverPort,
      version: this.version,
      createdAt: this.createdAt,
      lastConnected: this.lastConnected,
      connectedCount: this.connectedCount
    };
  }

  destroy() {
    this.cleanup();
    if (this.bot) {
      try {
        this.bot.removeAllListeners();
        this.bot.end();
      } catch (e) {
        // Ignore errors
      }
      this.bot = null;
    }
    delete botData[this.id];
    saveBotData();
  }
}

// Helper functions
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

// Health check function for other services
async function checkServiceHealth(serviceUrl) {
  return new Promise((resolve) => {
    const url = new URL(serviceUrl);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname || '/health',
      method: 'GET',
      timeout: 5000
    };

    const req = httpModule.request(options, (res) => {
      resolve({ url: serviceUrl, status: res.statusCode, healthy: res.statusCode === 200 });
    });

    req.on('error', () => {
      resolve({ url: serviceUrl, status: 'error', healthy: false });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ url: serviceUrl, status: 'timeout', healthy: false });
    });

    req.end();
  });
}

// WebSocket clients storage (defined before server to be available in HTTP handlers)
const wsClients = new Set();

// HTTP Server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // Serve static files from public directory
    if (pathname.startsWith('/') && (pathname === '/' || pathname.match(/\.(html|css|js|png|jpg|jpeg|gif|ico|svg)$/))) {
      let filePath = pathname === '/' ? '/index.html' : pathname;
      const fullPath = path.join(__dirname, 'public', filePath);
      
      // Security: prevent directory traversal
      if (!fullPath.startsWith(path.join(__dirname, 'public'))) {
        sendJSON(res, 403, { error: 'Forbidden' });
        return;
      }
      
      fs.readFile(fullPath, (err, data) => {
        if (err) {
          if (pathname === '/') {
            // If index.html doesn't exist, show API info
            sendJSON(res, 200, {
              status: 'active',
              message: 'Minecraft Bot API Service',
              version: '2.0.0',
              webInterface: 'Available at /index.html',
              endpoints: {
                'GET /health': 'Health check endpoint',
                'GET /health/monitor': 'Monitor endpoint for keep-awake (self + other services)',
                'GET /ping': 'Ping endpoint (returns pong)',
                'GET /bots': 'List all bots',
                'POST /bots': 'Create a new bot',
                'GET /bots/:id': 'Get bot status',
                'DELETE /bots/:id': 'Delete a bot',
                'POST /bots/:id/move': 'Control bot movement',
                'POST /bots/:id/look': 'Control bot look direction',
                'POST /bots/:id/chat': 'Send chat message',
                'POST /bots/:id/attack': 'Attack nearest entity',
                'GET /bots/:id/inventory': 'Get bot inventory',
                'POST /bots/:id/place': 'Place a block',
                'POST /bots/:id/dig': 'Dig a block',
                'POST /bots/:id/use': 'Use item in hand'
              },
              stats: {
                totalBots: bots.size,
                connectedBots: Array.from(bots.values()).filter(b => b.status === 'connected').length
              }
            });
          } else {
            sendJSON(res, 404, { error: 'File not found' });
          }
          return;
        }
        
        // Determine content type
        const ext = path.extname(fullPath).toLowerCase();
        const contentTypes = {
          '.html': 'text/html',
          '.css': 'text/css',
          '.js': 'application/javascript',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.ico': 'image/x-icon',
          '.svg': 'image/svg+xml'
        };
        
        res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
        res.end(data);
      });
      return;
    }

    // GET /api - API Information (alternative endpoint)
    if (pathname === '/api' && method === 'GET') {
      sendJSON(res, 200, {
        status: 'active',
        message: 'Minecraft Bot API Service',
        version: '2.0.0',
        endpoints: {
          'GET /health': 'Health check endpoint',
          'GET /health/monitor': 'Monitor endpoint for keep-awake (self + other services)',
          'GET /ping': 'Ping endpoint (returns pong)',
          'GET /bots': 'List all bots',
          'POST /bots': 'Create a new bot',
          'GET /bots/:id': 'Get bot status',
          'DELETE /bots/:id': 'Delete a bot',
          'POST /bots/:id/move': 'Control bot movement',
          'POST /bots/:id/look': 'Control bot look direction',
          'POST /bots/:id/chat': 'Send chat message',
          'POST /bots/:id/attack': 'Attack nearest entity',
          'GET /bots/:id/inventory': 'Get bot inventory',
          'POST /bots/:id/place': 'Place a block',
          'POST /bots/:id/dig': 'Dig a block',
          'POST /bots/:id/use': 'Use item in hand'
        },
        stats: {
          totalBots: bots.size,
          connectedBots: Array.from(bots.values()).filter(b => b.status === 'connected').length
        }
      });
      return;
    }

    // GET / - Redirect to web interface or show API info
    if (pathname === '/' && method === 'GET') {
      sendJSON(res, 200, {
        status: 'active',
        message: 'Minecraft Bot API Service',
        version: '2.0.0',
        endpoints: {
          'GET /health': 'Health check endpoint',
          'GET /health/monitor': 'Monitor endpoint for keep-awake (self + other services)',
          'GET /ping': 'Ping endpoint (returns pong)',
          'GET /bots': 'List all bots',
          'POST /bots': 'Create a new bot',
          'GET /bots/:id': 'Get bot status',
          'DELETE /bots/:id': 'Delete a bot',
          'POST /bots/:id/move': 'Control bot movement',
          'POST /bots/:id/look': 'Control bot look direction',
          'POST /bots/:id/chat': 'Send chat message',
          'POST /bots/:id/attack': 'Attack nearest entity',
          'GET /bots/:id/inventory': 'Get bot inventory',
          'POST /bots/:id/place': 'Place a block',
          'POST /bots/:id/dig': 'Dig a block',
          'POST /bots/:id/use': 'Use item in hand'
        },
        stats: {
          totalBots: bots.size,
          connectedBots: Array.from(bots.values()).filter(b => b.status === 'connected').length
        }
      });
      return;
    }

    // GET /health - Health check
    if (pathname === '/health' && method === 'GET') {
      sendJSON(res, 200, {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        bots: {
          total: bots.size,
          connected: Array.from(bots.values()).filter(b => b.status === 'connected').length,
          disconnected: Array.from(bots.values()).filter(b => b.status === 'disconnected').length,
          reconnecting: Array.from(bots.values()).filter(b => b.status === 'reconnecting').length
        }
      });
      return;
    }

    // GET /health/monitor - Keep-awake monitor for self and other services
    if (pathname === '/health/monitor' && method === 'GET') {
      const selfHealth = {
        service: 'self',
        url: `http://${req.headers.host}`,
        status: 'healthy',
        timestamp: new Date().toISOString()
      };

      const serviceChecks = [selfHealth];

      // Check other services if configured
      if (MONITOR_SERVICES.length > 0) {
        const checks = await Promise.all(
          MONITOR_SERVICES.map(serviceUrl => checkServiceHealth(serviceUrl))
        );
        serviceChecks.push(...checks.map(check => ({
          service: check.url,
          url: check.url,
          status: check.healthy ? 'healthy' : 'unhealthy',
          httpStatus: check.status,
          timestamp: new Date().toISOString()
        })));
      }

      sendJSON(res, 200, {
        status: 'monitoring',
        timestamp: new Date().toISOString(),
        services: serviceChecks,
        summary: {
          total: serviceChecks.length,
          healthy: serviceChecks.filter(s => s.status === 'healthy').length,
          unhealthy: serviceChecks.filter(s => s.status === 'unhealthy').length
        }
      });
      return;
    }

    // GET /ping - Ping pong
    if (pathname === '/ping' && method === 'GET') {
      sendJSON(res, 200, {
        pong: true,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // GET /servers - Get servers history
    if (pathname === '/servers' && method === 'GET') {
      sendJSON(res, 200, {
        servers: serversHistory,
        count: serversHistory.length
      });
      return;
    }

    // DELETE /servers/:key - Delete server from history
    if (pathname.startsWith('/servers/') && method === 'DELETE') {
      const serverKey = decodeURIComponent(pathname.substring('/servers/'.length));
      const index = serversHistory.findIndex(s => s.key === serverKey);
      
      if (index >= 0) {
        serversHistory.splice(index, 1);
        saveServersHistory();
        sendJSON(res, 200, {
          success: true,
          message: 'Server removed from history'
        });
      } else {
        sendJSON(res, 404, { error: 'Server not found in history' });
      }
      return;
    }

    // GET /servers/export - Export servers history as CSV
    if (pathname === '/servers/export' && method === 'GET') {
      const csv = exportServersHistoryToCSV();
      res.writeHead(200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="servers-history-${new Date().toISOString().split('T')[0]}.csv"`
      });
      res.end(csv);
      return;
    }

    // POST /servers/import - Import servers history from CSV
    if (pathname === '/servers/import' && method === 'POST') {
      const body = await parseBody(req);
      const { csv } = body;
      
      if (!csv) {
        sendJSON(res, 400, { error: 'CSV content is required' });
        return;
      }
      
      const result = importServersHistoryFromCSV(csv);
      if (result.success) {
        sendJSON(res, 200, result);
      } else {
        sendJSON(res, 400, result);
      }
      return;
    }

    // GET /bots - List all bots
    if (pathname === '/bots' && method === 'GET') {
      const botList = Array.from(bots.values()).map(bot => bot.getStatus());
      sendJSON(res, 200, {
        bots: botList,
        count: botList.length,
        connected: botList.filter(b => b.connected).length
      });
      return;
    }

    // POST /bots - Create a new bot
    if (pathname === '/bots' && method === 'POST') {
      const body = await parseBody(req);
      const { name, serverHost, serverPort, username, version, authKey } = body;

      if (!name || !serverHost) {
        sendJSON(res, 400, {
          error: 'Missing required fields',
          required: ['name', 'serverHost'],
          optional: ['serverPort', 'username', 'version', 'authKey']
        });
        return;
      }

      const botId = uuidv4();
      const botManager = new BotManager(botId, {
        name,
        serverHost,
        serverPort: serverPort || 25565,
        username: username || name,
        version: version || null, // null = auto-detect (recommended)
        authKey: authKey || null
      });

      bots.set(botId, botManager);
      
      // Add server to history
      addServerToHistory(serverHost, serverPort || 25565, version || null, username || name);
      
      botManager.createBot();

      // Broadcast bot creation via WebSocket
      setTimeout(() => {
        if (global.broadcastBotStatus) {
          global.broadcastBotStatus(botId);
        }
      }, 1000);

      sendJSON(res, 201, {
        success: true,
        bot: botManager.getStatus(),
        controlUrl: `/bots/${botId}`
      });
      return;
    }

    // Bot-specific routes
    const botRouteMatch = pathname.match(/^\/bots\/([^/]+)(?:\/(.+))?$/);
    if (botRouteMatch) {
      const botId = botRouteMatch[1];
      const subPath = botRouteMatch[2] || '';
      const botManager = bots.get(botId);

      if (!botManager) {
        sendJSON(res, 404, { error: 'Bot not found' });
        return;
      }

      // GET /bots/:id - Get bot status
      if (subPath === '' && method === 'GET') {
        sendJSON(res, 200, botManager.getStatus());
        return;
      }

      // DELETE /bots/:id - Delete bot
      if (subPath === '' && method === 'DELETE') {
        botManager.destroy();
        bots.delete(botId);
        
        // Broadcast bot deletion via WebSocket
        const message = JSON.stringify({
          type: 'bot_deleted',
          botId: botId
        });
        wsClients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
        
        sendJSON(res, 200, {
          success: true,
          message: 'Bot deleted'
        });
        return;
      }

      // POST /bots/:id/move - Control movement
      if (subPath === 'move' && method === 'POST') {
        if (!botManager.bot) {
          console.log(`[${new Date().toLocaleTimeString()}] [${botManager.name}] Move command: Bot object is null`);
          sendJSON(res, 400, { error: 'Bot not connected' });
          return;
        }

        if (!botManager.bot.entity) {
          console.log(`[${new Date().toLocaleTimeString()}] [${botManager.name}] Move command: Bot entity is null`);
          sendJSON(res, 400, { error: 'Bot entity not available' });
          return;
        }
        
        // Check if bot is alive
        if (botManager.bot.health !== undefined && botManager.bot.health <= 0) {
          console.log(`[${new Date().toLocaleTimeString()}] [${botManager.name}] Move command: Bot is dead (health: ${botManager.bot.health})`);
          sendJSON(res, 400, { 
            error: 'Bot is dead', 
            message: 'Bot needs to respawn first. It will respawn automatically.',
            health: botManager.bot.health
          });
          return;
        }

        const body = await parseBody(req);
        const { action, duration = 1000 } = body;
        const validActions = ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'sneak'];
        
        if (!action || !validActions.includes(action)) {
          sendJSON(res, 400, {
            error: 'Invalid action',
            validActions: validActions
          });
          return;
        }

        try {
          console.log(`[${new Date().toLocaleTimeString()}] [${botManager.name}] 🎮 Executing move command: ${action} for ${duration}ms`);
          
          if (botManager.bot.entity && botManager.bot.entity.position) {
            console.log(`[${new Date().toLocaleTimeString()}] [${botManager.name}] Position: ${botManager.bot.entity.position.x.toFixed(2)}, ${botManager.bot.entity.position.y.toFixed(2)}, ${botManager.bot.entity.position.z.toFixed(2)}`);
            console.log(`[${new Date().toLocaleTimeString()}] [${botManager.name}] onGround: ${botManager.bot.entity.onGround}`);
          }
          
          // Clear any existing control states first to avoid conflicts
          if (botManager.bot.clearControlStates) {
            botManager.bot.clearControlStates();
          }
          
          // Small delay to ensure states are cleared
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Set the control state
          if (botManager.bot.setControlState) {
            botManager.bot.setControlState(action, true);
            console.log(`[${new Date().toLocaleTimeString()}] [${botManager.name}] ✅ Control state ${action} set to TRUE`);
          } else {
            throw new Error('setControlState method not available');
          }
          
          // Release after duration
          setTimeout(() => {
            if (botManager.bot && botManager.bot.setControlState) {
              botManager.bot.setControlState(action, false);
              console.log(`[${new Date().toLocaleTimeString()}] [${botManager.name}] Control state ${action} set to FALSE`);
            }
          }, duration);

          sendJSON(res, 200, {
            success: true,
            action: action,
            duration: duration
          });
        } catch (err) {
          console.error(`[${new Date().toLocaleTimeString()}] [${botManager.name}] ❌ Error executing move command:`, err);
          console.error(`[${new Date().toLocaleTimeString()}] [${botManager.name}] Error stack:`, err.stack);
          sendJSON(res, 500, { error: err.message });
        }
        return;
      }

      // POST /bots/:id/look - Look direction
      if (subPath === 'look' && method === 'POST') {
        if (!botManager.bot || !botManager.bot.entity) {
          sendJSON(res, 400, { error: 'Bot not connected' });
          return;
        }

        const body = await parseBody(req);
        const { yaw, pitch } = body;

        if (yaw === undefined || pitch === undefined) {
          sendJSON(res, 400, { error: 'yaw and pitch required' });
          return;
        }

        botManager.bot.look(yaw, pitch, true);
        sendJSON(res, 200, {
          success: true,
          yaw: yaw,
          pitch: pitch
        });
        return;
      }

      // POST /bots/:id/chat - Send chat message
      if (subPath === 'chat' && method === 'POST') {
        if (!botManager.bot || !botManager.bot.entity) {
          sendJSON(res, 400, { error: 'Bot not connected' });
          return;
        }

        const body = await parseBody(req);
        const { message } = body;

        if (!message) {
          sendJSON(res, 400, { error: 'message field required' });
          return;
        }

        botManager.bot.chat(message);
        sendJSON(res, 200, {
          success: true,
          message: message
        });
        return;
      }

      // POST /bots/:id/attack - Attack nearest entity
      if (subPath === 'attack' && method === 'POST') {
        if (!botManager.bot || !botManager.bot.entity) {
          sendJSON(res, 400, { error: 'Bot not connected' });
          return;
        }

        const entity = botManager.bot.nearestEntity();
        if (!entity) {
          sendJSON(res, 200, { success: false, message: 'No nearby entities' });
          return;
        }

        botManager.bot.attack(entity);
        sendJSON(res, 200, {
          success: true,
          target: entity.name || 'unknown',
          distance: botManager.bot.entity.position.distanceTo(entity.position).toFixed(2)
        });
        return;
      }

      // GET /bots/:id/inventory - Get inventory
      if (subPath === 'inventory' && method === 'GET') {
        if (!botManager.bot || !botManager.bot.entity) {
          sendJSON(res, 400, { error: 'Bot not connected' });
          return;
        }

        const items = [];
        for (let i = 0; i < botManager.bot.inventory.items().length; i++) {
          const item = botManager.bot.inventory.items()[i];
          items.push({
            slot: i,
            name: item.name,
            count: item.count,
            displayName: item.displayName
          });
        }

        sendJSON(res, 200, {
          items: items,
          heldItem: botManager.bot.heldItem ? {
            name: botManager.bot.heldItem.name,
            count: botManager.bot.heldItem.count
          } : null
        });
        return;
      }

      // POST /bots/:id/place - Place block
      if (subPath === 'place' && method === 'POST') {
        if (!botManager.bot || !botManager.bot.entity) {
          sendJSON(res, 400, { error: 'Bot not connected' });
          return;
        }

        const body = await parseBody(req);
        const { x, y, z, blockName } = body;

        if (x === undefined || y === undefined || z === undefined || !blockName) {
          sendJSON(res, 400, { error: 'x, y, z, and blockName required' });
          return;
        }

        const targetBlock = botManager.bot.blockAt(botManager.bot.vec3(x, y, z));
        if (!targetBlock) {
          sendJSON(res, 400, { error: 'Invalid block at position' });
          return;
        }

        try {
          await botManager.bot.placeBlock(targetBlock, botManager.bot.heldItem);
          sendJSON(res, 200, {
            success: true,
            position: { x, y, z },
            block: blockName
          });
        } catch (err) {
          sendJSON(res, 400, { error: err.message });
        }
        return;
      }

      // POST /bots/:id/dig - Dig block
      if (subPath === 'dig' && method === 'POST') {
        if (!botManager.bot || !botManager.bot.entity) {
          sendJSON(res, 400, { error: 'Bot not connected' });
          return;
        }

        const body = await parseBody(req);
        const { x, y, z } = body;

        if (x === undefined || y === undefined || z === undefined) {
          sendJSON(res, 400, { error: 'x, y, z required' });
          return;
        }

        const targetBlock = botManager.bot.blockAt(botManager.bot.vec3(x, y, z));
        if (!targetBlock) {
          sendJSON(res, 400, { error: 'Invalid block at position' });
          return;
        }

        try {
          await botManager.bot.dig(targetBlock);
          sendJSON(res, 200, {
            success: true,
            position: { x, y, z }
          });
        } catch (err) {
          sendJSON(res, 400, { error: err.message });
        }
        return;
      }

      // POST /bots/:id/respawn - Force respawn
      if (subPath === 'respawn' && method === 'POST') {
        if (!botManager.bot) {
          sendJSON(res, 400, { error: 'Bot not connected' });
          return;
        }

        try {
          if (botManager.bot.respawn) {
            botManager.bot.respawn();
            console.log(`[${new Date().toLocaleTimeString()}] [${botManager.name}] 🔄 Manual respawn triggered`);
            sendJSON(res, 200, {
              success: true,
              message: 'Respawn command sent'
            });
          } else {
            sendJSON(res, 400, {
              error: 'Respawn method not available',
              message: 'Bot will respawn automatically when dead'
            });
          }
        } catch (err) {
          console.error(`[${new Date().toLocaleTimeString()}] [${botManager.name}] Respawn error:`, err);
          sendJSON(res, 500, { error: err.message });
        }
        return;
      }

      // POST /bots/:id/use - Use item
      if (subPath === 'use' && method === 'POST') {
        if (!botManager.bot || !botManager.bot.entity) {
          sendJSON(res, 400, { error: 'Bot not connected' });
          return;
        }

        try {
          botManager.bot.activateItem();
          sendJSON(res, 200, {
            success: true,
            message: 'Item activated'
          });
        } catch (err) {
          sendJSON(res, 400, { error: err.message });
        }
        return;
      }
    }

    // 404 - Not found
    sendJSON(res, 404, { error: 'Endpoint not found' });
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] Error: ${err.message}`);
    sendJSON(res, 500, { error: err.message });
  }
});

// WebSocket Server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  console.log(`[${new Date().toLocaleTimeString()}] WebSocket client connected`);
  wsClients.add(ws);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      handleWebSocketMessage(ws, data);
    } catch (err) {
      console.error(`[${new Date().toLocaleTimeString()}] WebSocket message error:`, err.message);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    console.log(`[${new Date().toLocaleTimeString()}] WebSocket client disconnected`);
    wsClients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error(`[${new Date().toLocaleTimeString()}] WebSocket error:`, error.message);
    wsClients.delete(ws);
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'WebSocket connected successfully'
  }));
});

function handleWebSocketMessage(ws, data) {
  if (!data || !data.type) {
    console.log(`[${new Date().toLocaleTimeString()}] WebSocket: Received invalid message:`, data);
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    return;
  }

  switch (data.type) {
    case 'bot_control':
      // Handle bot control commands via WebSocket
      const { botId, action, command, message, x, y, z, blockName } = data;
      const botManager = bots.get(botId);
      
      if (!botManager) {
        ws.send(JSON.stringify({ type: 'error', message: 'Bot not found' }));
        return;
      }

      if (!botManager.bot || !botManager.bot.entity) {
        ws.send(JSON.stringify({ type: 'error', message: 'Bot not connected' }));
        return;
      }

      try {
        switch (action) {
          case 'move':
            if (command) {
              botManager.bot.setControlState(command, true);
              setTimeout(() => {
                if (botManager.bot) botManager.bot.setControlState(command, false);
              }, 1000);
            }
            break;
          case 'chat':
            if (message) {
              botManager.bot.chat(message);
            }
            break;
          case 'attack':
            const entity = botManager.bot.nearestEntity();
            if (entity) {
              botManager.bot.attack(entity);
            }
            break;
          case 'use':
            botManager.bot.activateItem();
            break;
          // Note: place and dig require async operations, better handled via HTTP API
        }
        
        // Broadcast status update
        broadcastBotStatus(botId);
      } catch (err) {
        console.error(`[${new Date().toLocaleTimeString()}] WebSocket bot_control error:`, err);
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
      }
      break;
    
    case 'subscribe_bot':
      // Client wants to receive updates for a specific bot
      if (data.botId) {
        ws.botId = data.botId;
        broadcastBotStatus(data.botId);
      }
      break;
    
    case 'connected':
    case 'bot_created':
    case 'bot_deleted':
    case 'bot_status':
      // These are server-to-client messages, ignore if received from client
      console.log(`[${new Date().toLocaleTimeString()}] WebSocket: Ignoring server message type from client: ${data.type}`);
      break;
    
    default:
      console.log(`[${new Date().toLocaleTimeString()}] WebSocket: Unknown message type: ${data.type}`);
      ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${data.type}` }));
  }
}

function broadcastBotStatus(botId) {
  const botManager = bots.get(botId);
  if (!botManager) return;

  const status = botManager.getStatus();
  const message = JSON.stringify({
    type: 'bot_status',
    botId: botId,
    status: status
  });

  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      // Send to all clients or only subscribed ones
      if (!client.botId || client.botId === botId) {
        client.send(message);
      }
    }
  });
}

// Make broadcastBotStatus globally available
global.broadcastBotStatus = broadcastBotStatus;

// Broadcast bot status updates periodically
setInterval(() => {
  bots.forEach((botManager, botId) => {
    broadcastBotStatus(botId);
  });
}, 5000); // Every 5 seconds

// Start server
server.listen(HTTP_PORT, () => {
  console.log(`[${new Date().toLocaleTimeString()}] ========================================`);
  console.log(`[${new Date().toLocaleTimeString()}] Minecraft Bot API Service`);
  console.log(`[${new Date().toLocaleTimeString()}] Environment: ${NODE_ENV}`);
  console.log(`[${new Date().toLocaleTimeString()}] ========================================`);
  console.log(`[${new Date().toLocaleTimeString()}] HTTP server listening on port ${HTTP_PORT}`);
  console.log(`[${new Date().toLocaleTimeString()}] WebSocket server ready`);
  loadBotData();
  loadServersHistory();
  console.log(`[${new Date().toLocaleTimeString()}] ========================================`);
  console.log(`[${new Date().toLocaleTimeString()}] Web Interface: http://localhost:${HTTP_PORT}/`);
  console.log(`[${new Date().toLocaleTimeString()}] Health endpoint: http://localhost:${HTTP_PORT}/health`);
  console.log(`[${new Date().toLocaleTimeString()}] Monitor endpoint: http://localhost:${HTTP_PORT}/health/monitor`);
  console.log(`[${new Date().toLocaleTimeString()}] Ping endpoint: http://localhost:${HTTP_PORT}/ping`);
  console.log(`[${new Date().toLocaleTimeString()}] Servers history: ${serversHistory.length} servers saved`);
  console.log(`[${new Date().toLocaleTimeString()}] ========================================`);
  if (NODE_ENV === 'development') {
    console.log(`[${new Date().toLocaleTimeString()}] 🛠️  Development mode - nodemon is watching for changes`);
    console.log(`[${new Date().toLocaleTimeString()}] 💡 Tip: Open your local Minecraft world to LAN to test bots`);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(`[${new Date().toLocaleTimeString()}] Shutting down...`);
  bots.forEach(bot => bot.destroy());
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log(`[${new Date().toLocaleTimeString()}] Shutting down...`);
  bots.forEach(bot => bot.destroy());
  server.close(() => {
    process.exit(0);
  });
});
