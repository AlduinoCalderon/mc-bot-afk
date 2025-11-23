const mineflayer = require('mineflayer');

const SERVER_HOST = 'Bots-b2YN.aternos.me';
const SERVER_PORT = 61601;
const USERNAME = 'AldoBot';
const JUMP_INTERVAL = 20000; // 20 segundos en milisegundos
const RECONNECT_DELAY = 5000; // 5 segundos antes de reconectar

let bot = null;
let jumpInterval = null;

function createBot() {
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
    scheduleReconnect();
    return;
  }

  bot.on('login', () => {
    console.log(`[${new Date().toLocaleTimeString()}] Bot conectado como ${bot.username}`);
  });

  bot.on('spawn', () => {
    if (bot && bot.entity && bot.entity.position) {
      console.log(`[${new Date().toLocaleTimeString()}] Bot hizo spawn en ${bot.entity.position.x.toFixed(2)}, ${bot.entity.position.y.toFixed(2)}, ${bot.entity.position.z.toFixed(2)}`);
    } else {
      console.log(`[${new Date().toLocaleTimeString()}] Bot hizo spawn`);
    }
    startJumping();
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
    scheduleReconnect();
  });

  bot.on('death', () => {
    console.log(`[${new Date().toLocaleTimeString()}] Bot murió, reconectando...`);
    cleanup();
    scheduleReconnect();
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
  console.log(`[${new Date().toLocaleTimeString()}] Reconectando en ${RECONNECT_DELAY / 1000} segundos...`);
  setTimeout(() => {
    console.log(`[${new Date().toLocaleTimeString()}] Intentando reconectar...`);
    createBot();
  }, RECONNECT_DELAY);
}

// Iniciar el bot
console.log(`[${new Date().toLocaleTimeString()}] Iniciando bot AFK...`);
createBot();

// Manejar cierre del proceso
process.on('SIGINT', () => {
  console.log(`[${new Date().toLocaleTimeString()}] Cerrando bot...`);
  cleanup();
  if (bot) bot.end();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(`[${new Date().toLocaleTimeString()}] Cerrando bot...`);
  cleanup();
  if (bot) bot.end();
  process.exit(0);
});

