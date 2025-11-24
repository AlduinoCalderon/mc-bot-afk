/**
 * Bot Controller - Handles bot-related HTTP requests
 */
const { v4: uuidv4 } = require('uuid');
const { parseBody, sendJSON, getTimestamp } = require('../utils/helpers');
const BotManager = require('../models/BotManager');
const storageService = require('../services/storageService');
const worldService = require('../services/worldService');

class BotController {
  constructor(bots) {
    this.bots = bots;
  }

  // GET /bots - List all bots
  listBots(req, res) {
    const botList = Array.from(this.bots.values()).map(bot => bot.getStatus());
    sendJSON(res, 200, {
      bots: botList,
      count: botList.length,
      connected: botList.filter(b => b.connected).length
    });
  }

  // POST /bots - Create a new bot
  async createBot(req, res) {
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
      version: version || null,
      authKey: authKey || null
    });

    this.bots.set(botId, botManager);
    storageService.addServerToHistory(serverHost, serverPort || 25565, version || null, username || name);
    botManager.createBot();

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
  }

  // GET /bots/:id - Get bot status
  getBot(req, res, botId) {
    const botManager = this.bots.get(botId);
    if (!botManager) {
      sendJSON(res, 404, { error: 'Bot not found' });
      return;
    }
    sendJSON(res, 200, botManager.getStatus());
  }

  // DELETE /bots/:id - Delete bot
  deleteBot(req, res, botId, wsClients) {
    const botManager = this.bots.get(botId);
    if (!botManager) {
      sendJSON(res, 404, { error: 'Bot not found' });
      return;
    }

    botManager.destroy();
    this.bots.delete(botId);
    
    const message = JSON.stringify({
      type: 'bot_deleted',
      botId: botId
    });
    wsClients.forEach(client => {
      if (client.readyState === require('ws').OPEN) {
        client.send(message);
      }
    });
    
    sendJSON(res, 200, {
      success: true,
      message: 'Bot deleted'
    });
  }

  // POST /bots/:id/move - Control movement
  async moveBot(req, res, botId) {
    const botManager = this.bots.get(botId);
    if (!botManager || !botManager.bot || !botManager.bot.entity) {
      sendJSON(res, 400, { error: 'Bot not connected' });
      return;
    }

    if (botManager.bot.health !== undefined && botManager.bot.health <= 0) {
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
      console.log(`[${getTimestamp()}] [${botManager.name}] 🎮 Executing move command: ${action} for ${duration}ms`);
      
      if (botManager.bot.clearControlStates) {
        botManager.bot.clearControlStates();
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      if (botManager.bot.setControlState) {
        botManager.bot.setControlState(action, true);
        console.log(`[${getTimestamp()}] [${botManager.name}] ✅ Control state ${action} set to TRUE`);
      }
      
      setTimeout(() => {
        if (botManager.bot && botManager.bot.setControlState) {
          botManager.bot.setControlState(action, false);
        }
      }, duration);

      sendJSON(res, 200, {
        success: true,
        action: action,
        duration: duration
      });
    } catch (err) {
      console.error(`[${getTimestamp()}] [${botManager.name}] ❌ Error executing move command:`, err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // POST /bots/:id/look - Look direction
  async lookBot(req, res, botId) {
    const botManager = this.bots.get(botId);
    if (!botManager || !botManager.bot || !botManager.bot.entity) {
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
  }

  // POST /bots/:id/chat - Send chat message
  async chatBot(req, res, botId) {
    const botManager = this.bots.get(botId);
    if (!botManager || !botManager.bot || !botManager.bot.entity) {
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
  }

  // POST /bots/:id/attack - Attack nearest entity
  attackBot(req, res, botId) {
    const botManager = this.bots.get(botId);
    if (!botManager || !botManager.bot || !botManager.bot.entity) {
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
  }

  // GET /bots/:id/inventory - Get inventory
  getInventory(req, res, botId) {
    const botManager = this.bots.get(botId);
    if (!botManager || !botManager.bot || !botManager.bot.entity) {
      sendJSON(res, 400, { error: 'Bot not connected' });
      return;
    }

    const items = [];
    const inventory = botManager.bot.inventory;
    
    for (let i = 0; i < 36; i++) {
      const item = inventory.slots[i];
      items.push({
        slot: i,
        name: item ? item.name : null,
        count: item ? item.count : 0,
        displayName: item ? item.displayName : null,
        isEmpty: !item || item.count === 0
      });
    }

    sendJSON(res, 200, {
      items: items,
      heldItem: botManager.bot.heldItem ? {
        name: botManager.bot.heldItem.name,
        count: botManager.bot.heldItem.count,
        slot: inventory.selectedHotbarSlot
      } : null
    });
  }

  // POST /bots/:id/inventory/swap - Swap items
  async swapInventory(req, res, botId) {
    const botManager = this.bots.get(botId);
    if (!botManager || !botManager.bot || !botManager.bot.entity) {
      sendJSON(res, 400, { error: 'Bot not connected' });
      return;
    }

    const body = await parseBody(req);
    const { fromSlot, toSlot } = body;

    if (fromSlot === undefined || toSlot === undefined) {
      sendJSON(res, 400, { error: 'fromSlot and toSlot required' });
      return;
    }

    try {
      const inventory = botManager.bot.inventory;
      
      if (inventory.swap) {
        await inventory.swap(fromSlot, toSlot);
        sendJSON(res, 200, {
          success: true,
          message: `Items swapped from slot ${fromSlot} to ${toSlot}`
        });
      } else {
        const fromItem = inventory.slots[fromSlot];
        if (fromItem) {
          await inventory.moveItem(fromSlot, toSlot);
        }
        sendJSON(res, 200, {
          success: true,
          message: `Item moved from slot ${fromSlot} to ${toSlot}`
        });
      }
    } catch (err) {
      console.error(`[${getTimestamp()}] [${botManager.name}] Inventory swap error:`, err);
      sendJSON(res, 400, { error: err.message });
    }
  }

  // POST /bots/:id/inventory/equip - Equip item
  async equipItem(req, res, botId) {
    const botManager = this.bots.get(botId);
    if (!botManager || !botManager.bot || !botManager.bot.entity) {
      sendJSON(res, 400, { error: 'Bot not connected' });
      return;
    }

    const body = await parseBody(req);
    const { slot } = body;

    if (slot === undefined) {
      sendJSON(res, 400, { error: 'slot required' });
      return;
    }

    try {
      const inventory = botManager.bot.inventory;
      
      if (slot >= 0 && slot < 36) {
        if (slot < 9) {
          inventory.selectHotbarSlot(slot);
          sendJSON(res, 200, {
            success: true,
            message: `Selected hotbar slot ${slot}`
          });
        } else {
          const targetHotbarSlot = inventory.selectedHotbarSlot || 0;
          await inventory.moveItem(slot, targetHotbarSlot);
          sendJSON(res, 200, {
            success: true,
            message: `Moved item from slot ${slot} to hotbar slot ${targetHotbarSlot}`
          });
        }
      } else {
        sendJSON(res, 400, { error: 'Invalid slot number (0-35)' });
      }
    } catch (err) {
      console.error(`[${getTimestamp()}] [${botManager.name}] Inventory equip error:`, err);
      sendJSON(res, 400, { error: err.message });
    }
  }

  // POST /bots/:id/place - Place block
  async placeBlock(req, res, botId) {
    const botManager = this.bots.get(botId);
    if (!botManager || !botManager.bot || !botManager.bot.entity) {
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
  }

  // POST /bots/:id/dig - Dig block
  async digBlock(req, res, botId) {
    const botManager = this.bots.get(botId);
    if (!botManager || !botManager.bot || !botManager.bot.entity) {
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
  }

  // POST /bots/:id/respawn - Force respawn
  respawnBot(req, res, botId) {
    const botManager = this.bots.get(botId);
    if (!botManager || !botManager.bot) {
      sendJSON(res, 400, { error: 'Bot not connected' });
      return;
    }

    try {
      if (botManager.bot.respawn) {
        botManager.bot.respawn();
        console.log(`[${getTimestamp()}] [${botManager.name}] 🔄 Manual respawn triggered`);
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
      console.error(`[${getTimestamp()}] [${botManager.name}] Respawn error:`, err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // POST /bots/:id/use - Use item
  useItem(req, res, botId) {
    const botManager = this.bots.get(botId);
    if (!botManager || !botManager.bot || !botManager.bot.entity) {
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
  }

  // GET /bots/:id/world - Get world data
  getWorldData(req, res, botId) {
    const botManager = this.bots.get(botId);
    if (!botManager || !botManager.bot || !botManager.bot.entity) {
      sendJSON(res, 400, { error: 'Bot not connected' });
      return;
    }

    try {
      const worldData = worldService.getWorldData(botManager.bot);
      sendJSON(res, 200, worldData);
    } catch (err) {
      console.error(`[${getTimestamp()}] [${botManager.name}] Error getting world data:`, err);
      sendJSON(res, 500, { error: err.message });
    }
  }
}

module.exports = BotController;

