/**
 * Minecraft Bot API Service - Main Entry Point
 * Clean, modular architecture with MVC pattern
 */
const http = require('http');
const BotManager = require('./models/BotManager');
const storageService = require('./services/storageService');
const WebSocketService = require('./services/websocketService');
const Router = require('./routes/router');
const { getTimestamp } = require('./utils/helpers');

// Configuration
const HTTP_PORT = process.env.PORT || 10000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const MONITOR_SERVICES = process.env.MONITOR_SERVICES ? process.env.MONITOR_SERVICES.split(',') : [];

// In-memory bot storage
const bots = new Map();

// Load existing bots from storage
function loadBotsFromStorage() {
  const botData = storageService.botData;
  Object.keys(botData).forEach(botId => {
    const data = botData[botId];
    const botManager = new BotManager(botId, {
      name: data.name,
      serverHost: data.serverHost,
      serverPort: data.serverPort,
      username: data.username,
      version: data.version,
      authKey: data.authKey || null
    });
    botManager.status = data.status;
    botManager.lastConnected = data.lastConnected;
    botManager.connectedCount = data.connectedCount;
      bots.set(botId, botManager);
      
    // Auto-connect if was connected before
    if (data.status === 'connected' || data.status === 'reconnecting') {
      botManager.createBot();
    }
  });
}

// Create HTTP server
const server = http.createServer();

// Setup WebSocket service
const wsService = new WebSocketService(server, bots);

// Setup Router
const router = new Router(server, bots, wsService.getClients(), MONITOR_SERVICES);

// Make broadcastBotStatus globally available
global.broadcastBotStatus = (botId) => {
  wsService.broadcastBotStatus(botId);
};

// Broadcast bot status updates periodically
setInterval(() => {
  bots.forEach((botManager, botId) => {
    wsService.broadcastBotStatus(botId);
  });
}, 5000);

// Start server
server.listen(HTTP_PORT, () => {
  console.log(`[${getTimestamp()}] ========================================`);
  console.log(`[${getTimestamp()}] Minecraft Bot API Service`);
  console.log(`[${getTimestamp()}] Environment: ${NODE_ENV}`);
  console.log(`[${getTimestamp()}] ========================================`);
  console.log(`[${getTimestamp()}] HTTP server listening on port ${HTTP_PORT}`);
  console.log(`[${getTimestamp()}] WebSocket server ready`);
  
  loadBotsFromStorage();
  
  console.log(`[${getTimestamp()}] ========================================`);
  const baseUrl = NODE_ENV === 'production' 
    ? `https://${process.env.RENDER_SERVICE_NAME || 'mc-aldobot'}.onrender.com`
    : `http://localhost:${HTTP_PORT}`;
  
  console.log(`[${getTimestamp()}] Web Interface: ${baseUrl}/`);
  console.log(`[${getTimestamp()}] Health endpoint: ${baseUrl}/health`);
  console.log(`[${getTimestamp()}] Monitor endpoint: ${baseUrl}/health/monitor`);
  console.log(`[${getTimestamp()}] Ping endpoint: ${baseUrl}/ping`);
  console.log(`[${getTimestamp()}] Servers history: ${storageService.getServersHistory().length} servers saved`);
  if (MONITOR_SERVICES.length > 0) {
    console.log(`[${getTimestamp()}] Monitoring services: ${MONITOR_SERVICES.join(', ')}`);
  }
  console.log(`[${getTimestamp()}] ========================================`);
  if (NODE_ENV === 'development') {
    console.log(`[${getTimestamp()}] 🛠️  Development mode - nodemon is watching for changes`);
    console.log(`[${getTimestamp()}] 💡 Tip: Open your local Minecraft world to LAN to test bots`);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(`[${getTimestamp()}] Shutting down...`);
  bots.forEach(bot => bot.destroy());
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log(`[${getTimestamp()}] Shutting down...`);
  bots.forEach(bot => bot.destroy());
  server.close(() => {
    process.exit(0);
  });
});

// Export for testing
module.exports = { server, bots, wsService };
