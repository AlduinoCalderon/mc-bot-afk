/**
 * Storage Service - Handles file-based persistence
 */
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'bots-data.json');
const SERVERS_HISTORY_FILE = path.join(__dirname, '..', 'servers-history.json');

class StorageService {
  constructor() {
    this.botData = {};
    this.serversHistory = [];
    this.loadBotData();
    this.loadServersHistory();
  }

  // Bot Data Management
  loadBotData() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        this.botData = JSON.parse(data);
        console.log(`[${new Date().toLocaleTimeString()}] Loaded ${Object.keys(this.botData).length} bots from storage`);
      }
    } catch (err) {
      console.log(`[${new Date().toLocaleTimeString()}] Error loading bot data: ${err.message}`);
      this.botData = {};
    }
  }

  saveBotData() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.botData, null, 2));
    } catch (err) {
      console.log(`[${new Date().toLocaleTimeString()}] Error saving bot data: ${err.message}`);
    }
  }

  getBotData(botId) {
    return this.botData[botId] || null;
  }

  setBotData(botId, data) {
    this.botData[botId] = data;
    this.saveBotData();
  }

  deleteBotData(botId) {
    delete this.botData[botId];
    this.saveBotData();
  }

  // Server History Management
  loadServersHistory() {
    try {
      if (fs.existsSync(SERVERS_HISTORY_FILE)) {
        const data = fs.readFileSync(SERVERS_HISTORY_FILE, 'utf8');
        this.serversHistory = JSON.parse(data);
        console.log(`[${new Date().toLocaleTimeString()}] Loaded ${this.serversHistory.length} servers from history`);
      }
    } catch (err) {
      console.log(`[${new Date().toLocaleTimeString()}] Error loading servers history: ${err.message}`);
      this.serversHistory = [];
    }
  }

  saveServersHistory() {
    try {
      fs.writeFileSync(SERVERS_HISTORY_FILE, JSON.stringify(this.serversHistory, null, 2));
    } catch (err) {
      console.log(`[${new Date().toLocaleTimeString()}] Error saving servers history: ${err.message}`);
    }
  }

  addServerToHistory(serverHost, serverPort, version, username) {
    const serverKey = `${serverHost}:${serverPort}`;
    const existingIndex = this.serversHistory.findIndex(s => s.key === serverKey);
    
    const serverEntry = {
      key: serverKey,
      host: serverHost,
      port: serverPort,
      version: version || null,
      username: username || null,
      lastUsed: new Date().toISOString(),
      useCount: existingIndex >= 0 ? this.serversHistory[existingIndex].useCount + 1 : 1
    };
    
    if (existingIndex >= 0) {
      this.serversHistory[existingIndex] = serverEntry;
    } else {
      this.serversHistory.push(serverEntry);
    }
    
    this.serversHistory.sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));
    
    if (this.serversHistory.length > 100) {
      this.serversHistory = this.serversHistory.slice(0, 100);
    }
    
    this.saveServersHistory();
    return serverEntry;
  }

  getServersHistory() {
    return this.serversHistory;
  }

  deleteServerFromHistory(serverKey) {
    const index = this.serversHistory.findIndex(s => s.key === serverKey);
    if (index >= 0) {
      this.serversHistory.splice(index, 1);
      this.saveServersHistory();
      return true;
    }
    return false;
  }

  exportServersHistoryToCSV() {
    const headers = ['Host', 'Port', 'Version', 'Username', 'Last Used', 'Use Count'];
    const rows = this.serversHistory.map(server => [
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

  importServersHistoryFromCSV(csvContent) {
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
            this.addServerToHistory(host, port, version, username);
            imported.push({ host, port });
          }
        }
      }
      
      return { success: true, imported: imported.length, message: `Imported ${imported.length} servers` };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
}

module.exports = new StorageService();

