/**
 * Health Service - Handles health checks and service monitoring
 */
const http = require('http');
const https = require('https');

class HealthService {
  async checkServiceHealth(serviceUrl) {
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

  getHealthStatus(bots) {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      bots: {
        total: bots.size,
        connected: Array.from(bots.values()).filter(b => b.status === 'connected').length,
        disconnected: Array.from(bots.values()).filter(b => b.status === 'disconnected').length,
        reconnecting: Array.from(bots.values()).filter(b => b.status === 'reconnecting').length
      }
    };
  }

  async getMonitorStatus(req, monitorServices) {
    const selfHealth = {
      service: 'self',
      url: `http://${req.headers.host}`,
      status: 'healthy',
      timestamp: new Date().toISOString()
    };

    const serviceChecks = [selfHealth];

    if (monitorServices.length > 0) {
      const checks = await Promise.all(
        monitorServices.map(serviceUrl => this.checkServiceHealth(serviceUrl))
      );
      serviceChecks.push(...checks.map(check => ({
        service: check.url,
        url: check.url,
        status: check.healthy ? 'healthy' : 'unhealthy',
        httpStatus: check.status,
        timestamp: new Date().toISOString()
      })));
    }

    return {
      status: 'monitoring',
      timestamp: new Date().toISOString(),
      services: serviceChecks,
      summary: {
        total: serviceChecks.length,
        healthy: serviceChecks.filter(s => s.status === 'healthy').length,
        unhealthy: serviceChecks.filter(s => s.status === 'unhealthy').length
      }
    };
  }
}

module.exports = new HealthService();

