/**
 * Bot Manager Model - Handles bot lifecycle and state
 */
const mineflayer = require('mineflayer');
const { getTimestamp } = require('../utils/helpers');
const storageService = require('../services/storageService');

const JUMP_INTERVAL = 20000; // 20 seconds
const RECONNECT_DELAY = 10000; // 10 seconds

class BotManager {
  constructor(id, config) {
    this.id = id;
    this.name = config.name || `Bot-${id.substring(0, 8)}`;
    this.serverHost = config.serverHost;
    this.serverPort = config.serverPort || 25565;
    this.username = config.username || this.name;
    this.version = config.version || '1.21';
    this.authKey = config.authKey || null;
    
    this.bot = null;
    this.jumpInterval = null;
    this.isReconnecting = false;
    this.status = 'disconnected';
    this.createdAt = new Date().toISOString();
    this.lastConnected = null;
    this.connectedCount = 0;
    
    // Store initial data
    storageService.setBotData(id, {
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
    });
  }

  createBot() {
    if (this.bot || this.isReconnecting) {
      console.log(`[${getTimestamp()}] [${this.name}] Already connecting or connected`);
      return;
    }

    console.log(`[${getTimestamp()}] [${this.name}] 🔄 Creating bot connection...`);
    console.log(`[${getTimestamp()}] [${this.name}] Server: ${this.serverHost}:${this.serverPort}`);
    console.log(`[${getTimestamp()}] [${this.name}] Username: ${this.username}`);
    console.log(`[${getTimestamp()}] [${this.name}] Version: ${this.version}`);

    try {
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

      if (this.version) {
        botOptions.version = this.version;
        console.log(`[${getTimestamp()}] [${this.name}] Using specified version: ${this.version}`);
      } else {
        console.log(`[${getTimestamp()}] [${this.name}] No version specified, using auto-detect (recommended)`);
      }

      this.bot = mineflayer.createBot(botOptions);
      this.setupEventHandlers();
      console.log(`[${getTimestamp()}] [${this.name}] Bot instance created, waiting for connection...`);
    } catch (err) {
      console.error(`[${getTimestamp()}] [${this.name}] ❌ Error creating bot: ${err.message}`);
      this.handleVersionError(err);
    }
  }

  handleVersionError(err) {
    if (!err.message.includes('version') && !err.message.includes('null') && !err.message.includes('Cannot read')) {
      this.bot = null;
      this.status = 'error';
      this.scheduleReconnect();
      return;
    }

    console.log(`[${getTimestamp()}] [${this.name}] ⚠️ Version error detected`);
    const versionsToTry = this.version && this.version.startsWith('1.21')
      ? ['1.21', '1.20.6', '1.20.4', '1.20.1']
      : ['1.21', '1.20.6', '1.20.4', '1.20.1', '1.19.4'];
    
    versionsToTry.push(null); // Auto-detect as last resort

    for (const tryVersion of versionsToTry) {
      try {
        const versionLabel = tryVersion || 'auto-detect';
        console.log(`[${getTimestamp()}] [${this.name}] Trying version: ${versionLabel}...`);
        
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
        
        if (tryVersion !== null) {
          fallbackOptions.version = tryVersion;
        }
        
        this.bot = mineflayer.createBot(fallbackOptions);
        this.setupEventHandlers();
        console.log(`[${getTimestamp()}] [${this.name}] ✅ Bot instance created with version: ${versionLabel}`);
        
        if (tryVersion) {
          this.version = tryVersion;
        }
        return;
      } catch (versionErr) {
        continue;
      }
    }

    console.error(`[${getTimestamp()}] [${this.name}] ❌ All version attempts failed`);
    this.bot = null;
    this.status = 'error';
    this.scheduleReconnect();
  }

  setupEventHandlers() {
    this.bot.on('login', () => {
      console.log(`[${getTimestamp()}] [${this.name}] ✅ LOGIN SUCCESS - Connected as ${this.bot.username}`);
      this.status = 'connected';
      this.lastConnected = new Date().toISOString();
      this.connectedCount++;
      this.updateBotData();
      this.broadcastStatus();
    });

    this.bot.on('kicked', (reason) => {
      const reasonText = typeof reason === 'string' ? reason : JSON.stringify(reason);
      console.log(`[${getTimestamp()}] [${this.name}] Kicked: ${reasonText}`);
      this.status = 'kicked';
      this.cleanup();
      this.scheduleReconnect();
    });

    this.bot.on('error', (err) => {
      console.log(`[${getTimestamp()}] [${this.name}] Error: ${err.message}`);
      this.status = 'error';
      this.cleanup();
      this.scheduleReconnect();
    });

    this.bot.on('end', () => {
      console.log(`[${getTimestamp()}] [${this.name}] Connection ended`);
      this.status = 'disconnected';
      this.cleanup();
      if (!this.isReconnecting) {
        this.scheduleReconnect();
      }
    });

    this.bot.on('death', () => {
      console.log(`[${getTimestamp()}] [${this.name}] 💀 DIED - Waiting for respawn...`);
      this.status = 'dead';
      if (this.jumpInterval) {
        clearInterval(this.jumpInterval);
        this.jumpInterval = null;
      }
      if (this.bot && this.bot.clearControlStates) {
        this.bot.clearControlStates();
      }
    });

    this.bot.on('respawn', () => {
      console.log(`[${getTimestamp()}] [${this.name}] 🔄 RESPAWN - Bot is coming back to life`);
      this.status = 'respawned';
    });

    this.bot.on('spawn', () => {
      console.log(`[${getTimestamp()}] [${this.name}] ✅ SPAWN - Bot is in the world`);
      setTimeout(() => {
        const health = this.bot.health || 0;
        const isAlive = health > 0;
        console.log(`[${getTimestamp()}] [${this.name}] Health: ${health}/20, Alive: ${isAlive}`);
        
        if (!isAlive) {
          this.handleDeadSpawn();
        } else {
          this.handleSpawnComplete();
        }
      }, 500);
    });

    this.bot.on('game', () => {
      if (this.bot.game) {
        console.log(`[${getTimestamp()}] [${this.name}] Game mode: ${this.bot.game.gameMode}, level: ${this.bot.game.level}`);
      }
    });
  }

  handleDeadSpawn() {
    console.log(`[${getTimestamp()}] [${this.name}] 💀 Bot spawned but is DEAD, attempting to respawn...`);
    this.status = 'dead';
    
    if (this.bot.respawn) {
      try {
        console.log(`[${getTimestamp()}] [${this.name}] Attempting manual respawn...`);
        this.bot.respawn();
      } catch (err) {
        console.log(`[${getTimestamp()}] [${this.name}] Manual respawn failed: ${err.message}`);
      }
    } else {
      setTimeout(() => {
        if (this.bot && this.bot.health > 0) {
          console.log(`[${getTimestamp()}] [${this.name}] ✅ Bot respawned! Health: ${this.bot.health}`);
          this.status = 'connected';
          this.handleRespawnComplete();
        } else {
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
  }

  handleSpawnComplete() {
    if (this.status === 'dead' || this.status === 'respawned') {
      this.status = 'connected';
      console.log(`[${getTimestamp()}] [${this.name}] ✅ Bot is alive and ready!`);
    }
    
    setTimeout(() => {
      if (this.bot && this.bot.clearControlStates) {
        this.bot.clearControlStates();
        console.log(`[${getTimestamp()}] [${this.name}] Control states cleared`);
      }
    }, 200);
    
    if (this.bot && this.bot.entity && this.bot.entity.position) {
      const pos = this.bot.entity.position;
      console.log(`[${getTimestamp()}] [${this.name}] Position: ${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`);
      console.log(`[${getTimestamp()}] [${this.name}] onGround: ${this.bot.entity.onGround}`);
    }
    
    setTimeout(() => {
      if (this.bot && this.bot.health > 0) {
        this.startJumping();
      }
    }, 1000);
  }

  handleRespawnComplete() {
    this.status = 'connected';
    console.log(`[${getTimestamp()}] [${this.name}] ✅ Respawn complete! Bot is alive and ready!`);
    this.handleSpawnComplete();
  }

  startJumping() {
    if (this.jumpInterval) {
      clearInterval(this.jumpInterval);
      this.jumpInterval = null;
    }

    if (!this.bot || !this.bot.entity) {
      console.log(`[${getTimestamp()}] [${this.name}] Cannot start jumping: bot or entity not available`);
      return;
    }

    console.log(`[${getTimestamp()}] [${this.name}] Starting jump interval (every ${JUMP_INTERVAL/1000}s)`);
    this.jumpInterval = setInterval(() => {
      if (!this.bot || !this.bot.entity) {
        return;
      }
      
      try {
        this.bot.setControlState('jump', true);
        setTimeout(() => {
          if (this.bot && this.bot.setControlState) {
            this.bot.setControlState('jump', false);
          }
        }, 200);
        console.log(`[${getTimestamp()}] [${this.name}] Jumped (auto)`);
      } catch (err) {
        console.error(`[${getTimestamp()}] [${this.name}] Error in jump interval:`, err.message);
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
    if (this.isReconnecting) return;

    this.isReconnecting = true;
    this.status = 'reconnecting';

    if (this.bot) {
      try {
        this.bot.removeAllListeners();
        this.bot.end();
      } catch (e) {
        // Ignore
      }
      this.bot = null;
    }
    
    console.log(`[${getTimestamp()}] [${this.name}] Reconnecting in ${RECONNECT_DELAY / 1000} seconds...`);
    setTimeout(() => {
      this.isReconnecting = false;
      console.log(`[${getTimestamp()}] [${this.name}] Attempting to reconnect...`);
      this.createBot();
    }, RECONNECT_DELAY);
  }

  updateBotData() {
    const data = storageService.getBotData(this.id);
    if (data) {
      data.status = this.status;
      data.lastConnected = this.lastConnected;
      data.connectedCount = this.connectedCount;
      storageService.setBotData(this.id, data);
    }
  }
  
  broadcastStatus() {
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
        // Ignore
      }
      this.bot = null;
    }
    storageService.deleteBotData(this.id);
  }
}

module.exports = BotManager;

