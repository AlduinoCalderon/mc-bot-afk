/**
 * Server Controller - Handles server history endpoints
 */
const { parseBody, sendJSON } = require('../utils/helpers');
const storageService = require('../services/storageService');

class ServerController {
  // GET /servers - Get servers history
  getServers(req, res) {
    const servers = storageService.getServersHistory();
    sendJSON(res, 200, {
      servers: servers,
      count: servers.length
    });
  }

  // DELETE /servers/:key - Delete server from history
  deleteServer(req, res, serverKey) {
    const deleted = storageService.deleteServerFromHistory(serverKey);
    if (deleted) {
      sendJSON(res, 200, {
        success: true,
        message: 'Server removed from history'
      });
    } else {
      sendJSON(res, 404, { error: 'Server not found in history' });
    }
  }

  // GET /servers/export - Export servers history as CSV
  exportServers(req, res) {
    const csv = storageService.exportServersHistoryToCSV();
    res.writeHead(200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="servers-history-${new Date().toISOString().split('T')[0]}.csv"`
    });
    res.end(csv);
  }

  // POST /servers/import - Import servers history from CSV
  async importServers(req, res) {
    const body = await parseBody(req);
    const { csv } = body;
    
    if (!csv) {
      sendJSON(res, 400, { error: 'CSV content is required' });
      return;
    }
    
    const result = storageService.importServersHistoryFromCSV(csv);
    if (result.success) {
      sendJSON(res, 200, result);
    } else {
      sendJSON(res, 400, result);
    }
  }
}

module.exports = new ServerController();

