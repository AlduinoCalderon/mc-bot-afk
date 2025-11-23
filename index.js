const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalNear } = require('mineflayer-pathfinder').goals;

const SERVER_HOST = 'Fasbit.aternos.me';
const SERVER_PORT = 46405;
const USERNAME = 'AldoBot';
const TARGET_X = 63.522;
const TARGET_Y = 190.30646;
const TARGET_Z = 230.661;
const JUMP_INTERVAL = 20000; // 20 segundos en milisegundos
const RECONNECT_DELAY = 5000; // 5 segundos antes de reconectar

let bot = null;
let jumpInterval = null;
let isMoving = false;

function createBot() {
  // Crear el bot sin especificar versión para que detecte automáticamente
  bot = mineflayer.createBot({
    host: SERVER_HOST,
    port: SERVER_PORT,
    username: USERNAME,
    // No especificar versión - dejar que mineflayer la detecte del servidor
    // Optimizaciones de memoria para Render
    viewDistance: 'tiny', // Reducir distancia de vista
    chatLengthLimit: 100, // Limitar longitud de chat
    colorsEnabled: false, // Desactivar colores
    physicsEnabled: true, // Mantener física básica
    maxCatchupTicks: 2 // Reducir ticks de catchup
  });
  
  // Interceptar y modificar el evento de verificación de versión
  if (bot._client) {
    const originalEmit = bot._client.emit;
    bot._client.emit = function(event, ...args) {
      // Interceptar el evento de verificación de versión y modificarlo
      if (event === 'error' && args[0] && args[0].message && 
          args[0].message.includes('version 1.21.10')) {
        // Ignorar el error de versión y continuar
        console.log(`[${new Date().toLocaleTimeString()}] Ignorando error de versión, continuando...`);
        return;
      }
      return originalEmit.apply(this, [event, ...args]);
    };
  }

  // Cargar plugin de pathfinder
  bot.loadPlugin(pathfinder);

  bot.on('login', () => {
    console.log(`[${new Date().toLocaleTimeString()}] Bot conectado como ${bot.username}`);
  });

  bot.on('spawn', () => {
    console.log(`[${new Date().toLocaleTimeString()}] Bot hizo spawn en ${bot.entity.position.x.toFixed(2)}, ${bot.entity.position.y.toFixed(2)}, ${bot.entity.position.z.toFixed(2)}`);
    moveToTarget();
    startJumping();
  });

  bot.on('kicked', (reason) => {
    console.log(`[${new Date().toLocaleTimeString()}] Bot fue expulsado: ${reason}`);
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

function moveToTarget() {
  if (!bot || !bot.entity) return;
  
  const currentPos = bot.entity.position;
  const distance = Math.sqrt(
    Math.pow(currentPos.x - TARGET_X, 2) +
    Math.pow(currentPos.y - TARGET_Y, 2) +
    Math.pow(currentPos.z - TARGET_Z, 2)
  );

  // Si ya está cerca (menos de 1 bloque de distancia), no moverse
  if (distance < 1.0) {
    console.log(`[${new Date().toLocaleTimeString()}] Bot ya está en la posición objetivo`);
    isMoving = false;
    return;
  }

  console.log(`[${new Date().toLocaleTimeString()}] Moviendo bot hacia ${TARGET_X}, ${TARGET_Y}, ${TARGET_Z} (distancia: ${distance.toFixed(2)})`);
  isMoving = true;

  try {
    const goal = new GoalNear(TARGET_X, TARGET_Y, TARGET_Z, 1);
    bot.pathfinder.setGoal(goal);

    // Verificar cuando llegue al destino (intervalo más largo para reducir CPU)
    const checkArrival = setInterval(() => {
      if (!bot || !bot.entity) {
        clearInterval(checkArrival);
        return;
      }

      const currentPos = bot.entity.position;
      const currentDistance = Math.sqrt(
        Math.pow(currentPos.x - TARGET_X, 2) +
        Math.pow(currentPos.y - TARGET_Y, 2) +
        Math.pow(currentPos.z - TARGET_Z, 2)
      );

      if (currentDistance < 1.0) {
        console.log(`[${new Date().toLocaleTimeString()}] Bot llegó a la posición objetivo`);
        isMoving = false;
        clearInterval(checkArrival);
        // Asegurar que el bot se quede quieto
        if (bot && bot.clearControlStates) {
          bot.clearControlStates();
        }
      }
    }, 2000); // Aumentar intervalo para reducir uso de CPU/memoria
  } catch (err) {
    console.log(`[${new Date().toLocaleTimeString()}] Error al mover: ${err.message}`);
    isMoving = false;
  }
}

function startJumping() {
  // Limpiar intervalo anterior si existe
  if (jumpInterval) {
    clearInterval(jumpInterval);
  }

  jumpInterval = setInterval(() => {
    if (!bot || !bot.entity) return;
    
    const currentPos = bot.entity.position;
    const distance = Math.sqrt(
      Math.pow(currentPos.x - TARGET_X, 2) +
      Math.pow(currentPos.y - TARGET_Y, 2) +
      Math.pow(currentPos.z - TARGET_Z, 2)
    );

    // Solo saltar si está cerca del objetivo y no se está moviendo
    if (distance < 1.0 && !isMoving) {
      bot.setControlState('jump', true);
      setTimeout(() => {
        if (bot) bot.setControlState('jump', false);
      }, 200);
      console.log(`[${new Date().toLocaleTimeString()}] Bot saltó`);
    }
  }, JUMP_INTERVAL);
}

function cleanup() {
  if (jumpInterval) {
    clearInterval(jumpInterval);
    jumpInterval = null;
  }
  isMoving = false;
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

