/**
 * World Service - Handles world data retrieval for teleoperation
 */
const { getTimestamp } = require('../utils/helpers');

class WorldService {
  getWorldData(bot) {
    try {
      const pos = bot.entity.position;
      const radius = 8;
      const step = 3;
      
      const blocks = [];
      let blockCount = 0;
      const maxBlocks = 100;
      
      const botY = Math.floor(pos.y);
      
      // Solo buscar bloques cerca del nivel del bot (piso y 2 niveles arriba)
      for (let y = botY - 1; y <= botY + 2; y++) {
        for (let x = -radius; x <= radius; x += step) {
          for (let z = -radius; z <= radius; z += step) {
            if (blockCount >= maxBlocks) break;
            
            try {
              const blockPos = bot.vec3(
                Math.floor(pos.x) + x,
                y,
                Math.floor(pos.z) + z
              );
              const block = bot.blockAt(blockPos);
              if (block && block.name !== 'air' && block.name !== 'cave_air' && block.name !== 'void_air') {
                blocks.push({
                  x: blockPos.x,
                  y: blockPos.y,
                  z: blockPos.z,
                  name: block.name
                });
                blockCount++;
              }
            } catch (err) {
              continue;
            }
          }
          if (blockCount >= maxBlocks) break;
        }
        if (blockCount >= maxBlocks) break;
      }

      // Get nearby entities - Solo las más cercanas (máximo 5)
      const entities = [];
      const nearbyEntities = Object.values(bot.entities);
      const entityDistances = [];
      
      nearbyEntities.forEach(entity => {
        if (entity && entity.position) {
          const distance = pos.distanceTo(entity.position);
          if (distance <= 16) {
            entityDistances.push({
              entity: entity,
              distance: distance
            });
          }
        }
      });
      
      entityDistances.sort((a, b) => a.distance - b.distance);
      entityDistances.slice(0, 5).forEach(item => {
        const entity = item.entity;
        entities.push({
          id: entity.id,
          name: entity.name || 'unknown',
          position: {
            x: entity.position.x.toFixed(1),
            y: entity.position.y.toFixed(1),
            z: entity.position.z.toFixed(1)
          },
          distance: item.distance.toFixed(1)
        });
      });

      const yaw = bot.entity.yaw || 0;
      const pitch = bot.entity.pitch || 0;

      return {
        bot: {
          position: {
            x: pos.x.toFixed(2),
            y: pos.y.toFixed(2),
            z: pos.z.toFixed(2)
          },
          yaw: yaw.toFixed(2),
          pitch: pitch.toFixed(2),
          health: bot.health || 0,
          food: bot.food || 0
        },
        blocks: blocks,
        entities: entities,
        radius: radius,
        step: step,
        totalBlocks: blocks.length
      };
    } catch (err) {
      console.error(`[${getTimestamp()}] Error getting world data:`, err);
      throw err;
    }
  }
}

module.exports = new WorldService();

