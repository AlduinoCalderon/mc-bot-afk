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
let arrivalCheckInterval = null;
let isMoving = false;

function createBot() {
  try {
    bot = mineflayer.createBot({
      host: SERVER_HOST,
      port: SERVER_PORT,
      username: USERNAME,
      viewDistance: 'tiny', // Reducir distancia de vista para ahorrar memoria
      chatLengthLimit: 100, // Limitar longitud de chat
      colorsEnabled: false // Desactivar colores para ahorrar memoria
      // No especificar versión para que mineflayer la detecte automáticamente del servidor
    });

    // Cargar plugin de pathfinder
    bot.loadPlugin(pathfinder);
  } catch (err) {
    console.log(`[${new Date().toLocaleTimeString()}] Error al crear bot: ${err.message}`);
    scheduleReconnect();
    return;
  }

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
    // Filtrar errores de protocolo conocidos para evitar spam de logs
    if (err.message && err.message.includes('protocol')) {
      console.log(`[${new Date().toLocaleTimeString()}] Error de protocolo: ${err.message}`);
    } else {
      console.log(`[${new Date().toLocaleTimeString()}] Error: ${err.message}`);
    }
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

    // Verificar cuando llegue al destino
    if (arrivalCheckInterval) {
      clearInterval(arrivalCheckInterval);
    }
    arrivalCheckInterval = setInterval(() => {
      if (!bot || !bot.entity) {
        if (arrivalCheckInterval) {
          clearInterval(arrivalCheckInterval);
          arrivalCheckInterval = null;
        }
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
        if (arrivalCheckInterval) {
          clearInterval(arrivalCheckInterval);
          arrivalCheckInterval = null;
        }
        // Asegurar que el bot se quede quieto
        if (bot && bot.clearControlStates) {
          bot.clearControlStates();
        }
      }
    }, 2000); // Aumentar intervalo para reducir uso de CPU
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
  if (arrivalCheckInterval) {
    clearInterval(arrivalCheckInterval);
    arrivalCheckInterval = null;
  }
  isMoving = false;
  // Limpiar referencias para ayudar al garbage collector
  if (bot && bot.pathfinder && bot.pathfinder.isMoving) {
    try {
      bot.pathfinder.setGoal(null);
    } catch (e) {
      // Ignorar errores al limpiar
    }
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
  if (bot && bot.end) {
    bot.end();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(`[${new Date().toLocaleTimeString()}] Cerrando bot...`);
  cleanup();
  if (bot && bot.end) {
    bot.end();
  }
  process.exit(0);
});

