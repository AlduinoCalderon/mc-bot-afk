const mineflayer = require('mineflayer');
const http = require('http');

const SERVER_HOST = 'Bots-b2YN.aternos.me';
const SERVER_PORT = 61601;
const USERNAME = 'AldoBot';
const JUMP_INTERVAL = 20000; // 20 segundos en milisegundos
const RECONNECT_DELAY = 10000; // 10 segundos antes de reconectar (aumentado para evitar "logged in from another location")
const HTTP_PORT = process.env.PORT || 10000; // Puerto para mantener el servicio activo en Render

let bot = null;
let jumpInterval = null;
let isReconnecting = false; // Bandera para evitar múltiples reconexiones simultáneas

function createBot() {
  // Evitar crear múltiples bots simultáneamente
  if (bot || isReconnecting) {
    console.log(`[${new Date().toLocaleTimeString()}] Ya hay una conexión o reconexión en progreso, ignorando...`);
    return;
  }

  try {
    bot = mineflayer.createBot({
      host: SERVER_HOST,
      port: SERVER_PORT,
      username: USERNAME,
      // Usar versión 1.21 (protocolo 767) que es compatible con 1.21.10
      // El protocolo 773 (1.21.10) aún no está soportado en minecraft-protocol
      version: '1.21',
      // Optimizaciones de memoria para Render
      viewDistance: 'tiny', // Reducir distancia de vista
      chatLengthLimit: 100, // Limitar longitud de chat
      colorsEnabled: false, // Desactivar colores
      physicsEnabled: true, // Mantener física básica
      maxCatchupTicks: 2 // Reducir ticks de catchup
    });
  } catch (err) {
    console.log(`[${new Date().toLocaleTimeString()}] Error al crear bot: ${err.message}`);
    bot = null;
    scheduleReconnect();
    return;
  }

  bot.on('login', () => {
    if (bot && bot.username) {
      console.log(`[${new Date().toLocaleTimeString()}] Bot conectado como ${bot.username}`);
    } else {
      console.log(`[${new Date().toLocaleTimeString()}] Bot conectado como ${USERNAME}`);
    }
  });


  bot.on('kicked', (reason) => {
    const reasonText = typeof reason === 'string' ? reason : JSON.stringify(reason);
    console.log(`[${new Date().toLocaleTimeString()}] Bot fue expulsado: ${reasonText}`);
    cleanup();
    scheduleReconnect();
  });

  bot.on('error', (err) => {
    console.log(`[${new Date().toLocaleTimeString()}] Error: ${err.message}`);
    cleanup();
    scheduleReconnect();
  });

  bot.on('end', () => {
    console.log(`[${new Date().toLocaleTimeString()}] Conexión terminada`);
    cleanup();
    // No reconectar desde 'end' si ya se está reconectando desde otro evento
    if (!isReconnecting) {
      scheduleReconnect();
    }
  });

  bot.on('death', () => {
    console.log(`[${new Date().toLocaleTimeString()}] Bot murió, esperando respawn...`);
    // No reconectar, el bot respawneará automáticamente
    // Solo limpiar el intervalo de salto temporalmente
    if (jumpInterval) {
      clearInterval(jumpInterval);
      jumpInterval = null;
    }
  });

  // Cuando el bot respawnea después de morir, reiniciar el salto
  bot.on('spawn', () => {
    // Asegurar que el bot esté quieto
    if (bot && bot.clearControlStates) {
      bot.clearControlStates();
    }
    
    if (bot && bot.entity && bot.entity.position) {
      console.log(`[${new Date().toLocaleTimeString()}] Bot hizo spawn en ${bot.entity.position.x.toFixed(2)}, ${bot.entity.position.y.toFixed(2)}, ${bot.entity.position.z.toFixed(2)}`);
    } else {
      console.log(`[${new Date().toLocaleTimeString()}] Bot hizo spawn`);
    }
    // Reiniciar el salto cuando respawnea
    startJumping();
  });
}


function startJumping() {
  // Limpiar intervalo anterior si existe
  if (jumpInterval) {
    clearInterval(jumpInterval);
  }

  jumpInterval = setInterval(() => {
    if (!bot || !bot.entity) return;
    
    // Saltar cada 20 segundos
    bot.setControlState('jump', true);
    setTimeout(() => {
      if (bot) bot.setControlState('jump', false);
    }, 200);
    console.log(`[${new Date().toLocaleTimeString()}] Bot saltó`);
  }, JUMP_INTERVAL);
}

function cleanup() {
  if (jumpInterval) {
    clearInterval(jumpInterval);
    jumpInterval = null;
  }
}

function scheduleReconnect() {
  // Evitar múltiples reconexiones simultáneas
  if (isReconnecting) {
    console.log(`[${new Date().toLocaleTimeString()}] Ya hay una reconexión programada, ignorando...`);
    return;
  }

  isReconnecting = true;

  // Asegurar que el bot anterior esté completamente cerrado antes de reconectar
  if (bot) {
    try {
      bot.removeAllListeners(); // Remover todos los listeners para evitar eventos duplicados
      bot.end();
    } catch (e) {
      // Ignorar errores al cerrar
    }
    bot = null;
  }
  
  console.log(`[${new Date().toLocaleTimeString()}] Reconectando en ${RECONNECT_DELAY / 1000} segundos...`);
  setTimeout(() => {
    isReconnecting = false;
    console.log(`[${new Date().toLocaleTimeString()}] Intentando reconectar...`);
    createBot();
  }, RECONNECT_DELAY);
}

// Función para parsear el body de las peticiones POST
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

// Función para enviar respuesta JSON
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

// Crear servidor HTTP con endpoints para controlar el bot
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // GET / - Información del bot
    if (path === '/' && method === 'GET') {
      sendJSON(res, 200, {
        status: 'active',
        message: 'Bot AFK API - Usa /status para ver el estado del bot',
        endpoints: {
          'GET /status': 'Estado del bot',
          'POST /move': 'Mover el bot (forward, back, left, right, jump, sprint)',
          'POST /look': 'Mirar hacia una dirección (yaw, pitch)',
          'POST /attack': 'Atacar entidad cercana',
          'POST /chat': 'Enviar mensaje al chat',
          'POST /place': 'Colocar bloque (x, y, z, blockName)',
          'POST /dig': 'Minar bloque (x, y, z)',
          'POST /use': 'Usar item en la mano',
          'GET /inventory': 'Ver inventario'
        }
      });
      return;
    }

    // GET /status - Estado del bot
    if (path === '/status' && method === 'GET') {
      if (!bot || !bot.entity) {
        sendJSON(res, 200, {
          connected: false,
          message: 'Bot no conectado'
        });
        return;
      }

      sendJSON(res, 200, {
        connected: true,
        username: bot.username,
        position: bot.entity.position ? {
          x: bot.entity.position.x.toFixed(2),
          y: bot.entity.position.y.toFixed(2),
          z: bot.entity.position.z.toFixed(2)
        } : null,
        health: bot.health || 0,
        food: bot.food || 0,
        gameMode: bot.game.gameMode,
        ping: bot.player ? bot.player.ping : null
      });
      return;
    }

    // POST /move - Controlar movimiento
    if (path === '/move' && method === 'POST') {
      if (!bot || !bot.entity) {
        sendJSON(res, 400, { error: 'Bot no conectado' });
        return;
      }

      const body = await parseBody(req);
      const { action, duration = 1000 } = body;

      const validActions = ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'sneak'];
      
      if (!action || !validActions.includes(action)) {
        sendJSON(res, 400, {
          error: 'Acción inválida',
          validActions: validActions
        });
        return;
      }

      bot.setControlState(action, true);
      setTimeout(() => {
        if (bot) bot.setControlState(action, false);
      }, duration);

      sendJSON(res, 200, {
        success: true,
        action: action,
        duration: duration
      });
      return;
    }

    // POST /look - Mirar hacia una dirección
    if (path === '/look' && method === 'POST') {
      if (!bot || !bot.entity) {
        sendJSON(res, 400, { error: 'Bot no conectado' });
        return;
      }

      const body = await parseBody(req);
      const { yaw, pitch } = body;

      if (yaw === undefined || pitch === undefined) {
        sendJSON(res, 400, { error: 'Se requieren yaw y pitch' });
        return;
      }

      bot.look(yaw, pitch, true);

      sendJSON(res, 200, {
        success: true,
        yaw: yaw,
        pitch: pitch
      });
      return;
    }

    // POST /attack - Atacar entidad cercana
    if (path === '/attack' && method === 'POST') {
      if (!bot || !bot.entity) {
        sendJSON(res, 400, { error: 'Bot no conectado' });
        return;
      }

      const entity = bot.nearestEntity();
      if (!entity) {
        sendJSON(res, 200, { success: false, message: 'No hay entidades cercanas' });
        return;
      }

      bot.attack(entity);
      sendJSON(res, 200, {
        success: true,
        target: entity.name || 'unknown',
        distance: bot.entity.position.distanceTo(entity.position).toFixed(2)
      });
      return;
    }

    // POST /chat - Enviar mensaje al chat
    if (path === '/chat' && method === 'POST') {
      if (!bot || !bot.entity) {
        sendJSON(res, 400, { error: 'Bot no conectado' });
        return;
      }

      const body = await parseBody(req);
      const { message } = body;

      if (!message) {
        sendJSON(res, 400, { error: 'Se requiere el campo "message"' });
        return;
      }

      bot.chat(message);
      sendJSON(res, 200, {
        success: true,
        message: message
      });
      return;
    }

    // POST /place - Colocar bloque
    if (path === '/place' && method === 'POST') {
      if (!bot || !bot.entity) {
        sendJSON(res, 400, { error: 'Bot no conectado' });
        return;
      }

      const body = await parseBody(req);
      const { x, y, z, blockName } = body;

      if (x === undefined || y === undefined || z === undefined || !blockName) {
        sendJSON(res, 400, { error: 'Se requieren x, y, z y blockName' });
        return;
      }

      const targetBlock = bot.blockAt(bot.vec3(x, y, z));
      if (!targetBlock) {
        sendJSON(res, 400, { error: 'Bloque no válido en esa posición' });
        return;
      }

      try {
        await bot.placeBlock(targetBlock, bot.heldItem);
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

    // POST /dig - Minar bloque
    if (path === '/dig' && method === 'POST') {
      if (!bot || !bot.entity) {
        sendJSON(res, 400, { error: 'Bot no conectado' });
        return;
      }

      const body = await parseBody(req);
      const { x, y, z } = body;

      if (x === undefined || y === undefined || z === undefined) {
        sendJSON(res, 400, { error: 'Se requieren x, y, z' });
        return;
      }

      const targetBlock = bot.blockAt(bot.vec3(x, y, z));
      if (!targetBlock) {
        sendJSON(res, 400, { error: 'Bloque no válido en esa posición' });
        return;
      }

      try {
        await bot.dig(targetBlock);
        sendJSON(res, 200, {
          success: true,
          position: { x, y, z }
        });
      } catch (err) {
        sendJSON(res, 400, { error: err.message });
      }
      return;
    }

    // POST /use - Usar item en la mano
    if (path === '/use' && method === 'POST') {
      if (!bot || !bot.entity) {
        sendJSON(res, 400, { error: 'Bot no conectado' });
        return;
      }

      try {
        bot.activateItem();
        sendJSON(res, 200, {
          success: true,
          message: 'Item activado'
        });
      } catch (err) {
        sendJSON(res, 400, { error: err.message });
      }
      return;
    }

    // GET /inventory - Ver inventario
    if (path === '/inventory' && method === 'GET') {
      if (!bot || !bot.entity) {
        sendJSON(res, 400, { error: 'Bot no conectado' });
        return;
      }

      const items = [];
      for (let i = 0; i < bot.inventory.items().length; i++) {
        const item = bot.inventory.items()[i];
        items.push({
          slot: i,
          name: item.name,
          count: item.count,
          displayName: item.displayName
        });
      }

      sendJSON(res, 200, {
        items: items,
        heldItem: bot.heldItem ? {
          name: bot.heldItem.name,
          count: bot.heldItem.count
        } : null
      });
      return;
    }

    // 404 - Ruta no encontrada
    sendJSON(res, 404, { error: 'Endpoint no encontrado' });
  } catch (err) {
    sendJSON(res, 500, { error: err.message });
  }
});

server.listen(HTTP_PORT, () => {
  console.log(`[${new Date().toLocaleTimeString()}] Servidor HTTP escuchando en puerto ${HTTP_PORT}`);
});

// Iniciar el bot
console.log(`[${new Date().toLocaleTimeString()}] Iniciando bot AFK...`);
createBot();

// Manejar cierre del proceso
process.on('SIGINT', () => {
  console.log(`[${new Date().toLocaleTimeString()}] Cerrando bot...`);
  cleanup();
  if (bot) bot.end();
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log(`[${new Date().toLocaleTimeString()}] Cerrando bot...`);
  cleanup();
  if (bot) bot.end();
  server.close(() => {
    process.exit(0);
  });
});

