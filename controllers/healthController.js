/**
 * Health Controller - Handles health check endpoints
 */
const { sendJSON } = require('../utils/helpers');
const healthService = require('../services/healthService');

class HealthController {
  constructor(bots, monitorServices) {
    this.bots = bots;
    this.monitorServices = monitorServices;
  }

  // GET /health - Health check
  getHealth(req, res) {
    const health = healthService.getHealthStatus(this.bots);
    sendJSON(res, 200, health);
  }

  // GET /health/monitor - Monitor services
  async getMonitor(req, res) {
    const monitor = await healthService.getMonitorStatus(req, this.monitorServices);
    sendJSON(res, 200, monitor);
  }

  // GET /ping - Ping pong
  ping(req, res) {
    sendJSON(res, 200, {
      pong: true,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = HealthController;

