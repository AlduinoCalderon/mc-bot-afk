/**
 * WebSocket Service - Handles WebSocket connections and messages
 */
const WebSocket = require('ws');
const { getTimestamp } = require('../utils/helpers');
const worldService = require('../services/worldService');

class WebSocketService {
  constructor(server, bots) {
    this.bots = bots;
    this.wss = new WebSocket.Server({ server });
    this.clients = new Set();
    this.setupWebSocket();
  }

  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      console.log(`[${getTimestamp()}] WebSocket client connected`);
      this.clients.add(ws);

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage(ws, data);
        } catch (err) {
          console.error(`[${getTimestamp()}] WebSocket message error:`, err.message);
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        console.log(`[${getTimestamp()}] WebSocket client disconnected`);
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error(`[${getTimestamp()}] WebSocket error:`, error.message);
        this.clients.delete(ws);
      });

      ws.send(JSON.stringify({
        type: 'connected',
        message: 'WebSocket connected successfully'
      }));
    });
  }

  handleMessage(ws, data) {
    if (!data || !data.type) {
      console.log(`[${getTimestamp()}] WebSocket: Received invalid message:`, data);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      return;
    }

    switch (data.type) {
      case 'bot_control':
        this.handleBotControl(ws, data);
        break;
      case 'request_world_data':
        this.handleWorldDataRequest(ws, data);
        break;
      case 'subscribe_bot':
        if (data.botId) {
          ws.botId = data.botId;
          this.broadcastBotStatus(data.botId);
        }
        break;
      case 'connected':
      case 'bot_created':
      case 'bot_deleted':
      case 'bot_status':
        console.log(`[${getTimestamp()}] WebSocket: Ignoring server message type from client: ${data.type}`);
        break;
      default:
        console.log(`[${getTimestamp()}] WebSocket: Unknown message type: ${data.type}`);
        ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${data.type}` }));
    }
  }

  handleBotControl(ws, data) {
    const { botId, action, command, message, yaw, pitch, duration } = data;
    const botManager = this.bots.get(botId);
    
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
            const moveDuration = duration || 100;
            botManager.bot.setControlState(command, true);
            setTimeout(() => {
              if (botManager.bot) botManager.bot.setControlState(command, false);
            }, moveDuration);
          }
          break;
        case 'look':
          if (yaw !== undefined && pitch !== undefined) {
            botManager.bot.look(yaw, pitch, true);
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
      }
      
      this.broadcastBotStatus(botId);
    } catch (err) {
      console.error(`[${getTimestamp()}] WebSocket bot_control error:`, err);
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  }

  handleWorldDataRequest(ws, data) {
    const worldBotId = data.botId;
    const worldBotManager = this.bots.get(worldBotId);
    
    if (!worldBotManager || !worldBotManager.bot || !worldBotManager.bot.entity) {
      ws.send(JSON.stringify({ type: 'error', message: 'Bot not connected' }));
      return;
    }

    try {
      const worldData = worldService.getWorldData(worldBotManager.bot);
      
      ws.send(JSON.stringify({
        type: 'world_data',
        botId: worldBotId,
        bot: worldData.bot,
        blocks: worldData.blocks,
        entities: worldData.entities
      }));
    } catch (err) {
      console.error(`[${getTimestamp()}] WebSocket world_data error:`, err);
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  }

  broadcastBotStatus(botId) {
    const botManager = this.bots.get(botId);
    if (!botManager) return;

    const status = botManager.getStatus();
    const message = JSON.stringify({
      type: 'bot_status',
      botId: botId,
      status: status
    });

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        if (!client.botId || client.botId === botId) {
          client.send(message);
        }
      }
    });
  }

  getClients() {
    return this.clients;
  }
}

module.exports = WebSocketService;

