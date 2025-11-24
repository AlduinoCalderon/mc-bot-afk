/**
 * Router - Centralized route handler
 */
const path = require('path');
const fs = require('fs');
const { sendJSON } = require('../utils/helpers');
const BotController = require('../controllers/botController');
const HealthController = require('../controllers/healthController');
const serverController = require('../controllers/serverController');

class Router {
  constructor(server, bots, wsClients, monitorServices) {
    this.server = server;
    this.bots = bots;
    this.wsClients = wsClients;
    this.monitorServices = monitorServices;
    this.botController = new BotController(bots);
    this.healthController = new HealthController(bots, monitorServices);
    this.setupRoutes();
  }

  setupRoutes() {
    // Main HTTP handler
    this.server.on('request', async (req, res) => {
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
        // Serve static files
        if (await this.handleStaticFiles(req, res, pathname)) {
          return;
        }

        // API info endpoints
        if (this.handleApiInfo(req, res, pathname, method)) {
          return;
        }

        // Health routes
        if (this.handleHealthRoutes(req, res, pathname, method)) {
          return;
        }

        // Server routes
        if (this.handleServerRoutes(req, res, pathname, method)) {
          return;
        }

        // Bot routes
        if (await this.handleBotRoutes(req, res, pathname, method)) {
          return;
        }

        // 404 - Not found
        sendJSON(res, 404, { error: 'Endpoint not found' });
      } catch (err) {
        console.error(`[${new Date().toLocaleTimeString()}] Error: ${err.message}`);
        sendJSON(res, 500, { error: err.message });
      }
    });
  }

  handleHealthRoutes(req, res, pathname, method) {
    if (pathname === '/health' && method === 'GET') {
      this.healthController.getHealth(req, res);
      return true;
    }

    if (pathname === '/health/monitor' && method === 'GET') {
      this.healthController.getMonitor(req, res);
      return true;
    }

    if (pathname === '/ping' && method === 'GET') {
      this.healthController.ping(req, res);
      return true;
    }

    return false;
  }

  handleServerRoutes(req, res, pathname, method) {
    if (pathname === '/servers' && method === 'GET') {
      serverController.getServers(req, res);
      return true;
    }

    if (pathname.startsWith('/servers/') && method === 'DELETE') {
      const serverKey = decodeURIComponent(pathname.substring('/servers/'.length));
      serverController.deleteServer(req, res, serverKey);
      return true;
    }

    if (pathname === '/servers/export' && method === 'GET') {
      serverController.exportServers(req, res);
      return true;
    }

    if (pathname === '/servers/import' && method === 'POST') {
      serverController.importServers(req, res);
      return true;
    }

    return false;
  }

  async handleBotRoutes(req, res, pathname, method) {
    // GET /bots - List all bots
    if (pathname === '/bots' && method === 'GET') {
      this.botController.listBots(req, res);
      return true;
    }

    // POST /bots - Create bot
    if (pathname === '/bots' && method === 'POST') {
      await this.botController.createBot(req, res);
      return true;
    }

    // Bot-specific routes: /bots/:id
    const botRouteMatch = pathname.match(/^\/bots\/([^/]+)(?:\/(.+))?$/);
    if (botRouteMatch) {
      const botId = botRouteMatch[1];
      const subPath = botRouteMatch[2] || '';

      // GET /bots/:id
      if (subPath === '' && method === 'GET') {
        this.botController.getBot(req, res, botId);
        return true;
      }

      // DELETE /bots/:id
      if (subPath === '' && method === 'DELETE') {
        this.botController.deleteBot(req, res, botId, this.wsClients);
        return true;
      }

      // POST /bots/:id/move
      if (subPath === 'move' && method === 'POST') {
        await this.botController.moveBot(req, res, botId);
        return true;
      }

      // POST /bots/:id/look
      if (subPath === 'look' && method === 'POST') {
        await this.botController.lookBot(req, res, botId);
        return true;
      }

      // POST /bots/:id/chat
      if (subPath === 'chat' && method === 'POST') {
        await this.botController.chatBot(req, res, botId);
        return true;
      }

      // POST /bots/:id/attack
      if (subPath === 'attack' && method === 'POST') {
        this.botController.attackBot(req, res, botId);
        return true;
      }

      // GET /bots/:id/inventory
      if (subPath === 'inventory' && method === 'GET') {
        this.botController.getInventory(req, res, botId);
        return true;
      }

      // POST /bots/:id/inventory/swap
      if (subPath === 'inventory/swap' && method === 'POST') {
        await this.botController.swapInventory(req, res, botId);
        return true;
      }

      // POST /bots/:id/inventory/equip
      if (subPath === 'inventory/equip' && method === 'POST') {
        await this.botController.equipItem(req, res, botId);
        return true;
      }

      // POST /bots/:id/place
      if (subPath === 'place' && method === 'POST') {
        await this.botController.placeBlock(req, res, botId);
        return true;
      }

      // POST /bots/:id/dig
      if (subPath === 'dig' && method === 'POST') {
        await this.botController.digBlock(req, res, botId);
        return true;
      }

      // POST /bots/:id/respawn
      if (subPath === 'respawn' && method === 'POST') {
        this.botController.respawnBot(req, res, botId);
        return true;
      }

      // POST /bots/:id/use
      if (subPath === 'use' && method === 'POST') {
        this.botController.useItem(req, res, botId);
        return true;
      }

      // GET /bots/:id/world
      if (subPath === 'world' && method === 'GET') {
        this.botController.getWorldData(req, res, botId);
        return true;
      }
    }

    return false;
  }

  async handleStaticFiles(req, res, pathname) {
    if (pathname.startsWith('/') && (pathname === '/' || pathname.match(/\.(html|css|js|png|jpg|jpeg|gif|ico|svg)$/))) {
      return new Promise((resolve) => {
        let filePath = pathname === '/' ? '/index.html' : pathname;
        const fullPath = path.join(__dirname, '..', 'public', filePath);
        
        if (!fullPath.startsWith(path.join(__dirname, '..', 'public'))) {
          sendJSON(res, 403, { error: 'Forbidden' });
          resolve(true);
          return;
        }
        
        fs.readFile(fullPath, (err, data) => {
          if (err) {
            if (pathname === '/') {
              sendJSON(res, 200, {
                status: 'active',
                message: 'Minecraft Bot API Service',
                version: '2.0.0',
                webInterface: 'Available at /index.html',
                endpoints: {
                  'GET /health': 'Health check endpoint',
                  'GET /health/monitor': 'Monitor endpoint',
                  'GET /ping': 'Ping endpoint',
                  'GET /bots': 'List all bots',
                  'POST /bots': 'Create a new bot'
                }
              });
            } else {
              sendJSON(res, 404, { error: 'File not found' });
            }
            resolve(true);
            return;
          }
          
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
          resolve(true);
        });
      });
    }
    return false;
  }

  handleApiInfo(req, res, pathname, method) {
    if ((pathname === '/' || pathname === '/api') && method === 'GET') {
      sendJSON(res, 200, {
        status: 'active',
        message: 'Minecraft Bot API Service',
        version: '2.0.0',
        endpoints: {
          'GET /health': 'Health check endpoint',
          'GET /health/monitor': 'Monitor endpoint for keep-awake',
          'GET /ping': 'Ping endpoint (returns pong)',
          'GET /bots': 'List all bots',
          'POST /bots': 'Create a new bot',
          'GET /bots/:id': 'Get bot status',
          'DELETE /bots/:id': 'Delete a bot'
        },
        stats: {
          totalBots: this.bots.size,
          connectedBots: Array.from(this.bots.values()).filter(b => b.status === 'connected').length
        }
      });
      return true;
    }
    return false;
  }
}

module.exports = Router;

