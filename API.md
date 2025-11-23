# API del Bot AFK - Documentación

El bot ahora tiene una API REST completa para controlarlo remotamente.

## Endpoints Disponibles

### GET `/`
Información general y lista de endpoints disponibles.

**Ejemplo:**
```bash
curl https://tu-servicio.onrender.com/
```

---

### GET `/status`
Obtiene el estado actual del bot (conectado, posición, salud, etc.).

**Respuesta:**
```json
{
  "connected": true,
  "username": "AldoBot",
  "position": {
    "x": "63.52",
    "y": "190.31",
    "z": "230.66"
  },
  "health": 20,
  "food": 20,
  "gameMode": "survival",
  "ping": 45
}
```

---

### POST `/move`
Controla el movimiento del bot.

**Parámetros:**
- `action` (string, requerido): `forward`, `back`, `left`, `right`, `jump`, `sprint`, `sneak`
- `duration` (number, opcional): Duración en milisegundos (default: 1000)

**Ejemplo:**
```bash
curl -X POST https://tu-servicio.onrender.com/move \
  -H "Content-Type: application/json" \
  -d '{"action": "forward", "duration": 2000}'
```

---

### POST `/look`
Hace que el bot mire hacia una dirección específica.

**Parámetros:**
- `yaw` (number, requerido): Rotación horizontal en radianes (0 = norte, π/2 = este)
- `pitch` (number, requerido): Rotación vertical en radianes (-π/2 = arriba, π/2 = abajo)

**Ejemplo:**
```bash
curl -X POST https://tu-servicio.onrender.com/look \
  -H "Content-Type: application/json" \
  -d '{"yaw": 1.57, "pitch": 0}'
```

---

### POST `/attack`
Ataca la entidad más cercana al bot.

**Ejemplo:**
```bash
curl -X POST https://tu-servicio.onrender.com/attack \
  -H "Content-Type: application/json"
```

**Respuesta:**
```json
{
  "success": true,
  "target": "zombie",
  "distance": "3.45"
}
```

---

### POST `/chat`
Envía un mensaje al chat del servidor.

**Parámetros:**
- `message` (string, requerido): Mensaje a enviar

**Ejemplo:**
```bash
curl -X POST https://tu-servicio.onrender.com/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "¡Hola desde la API!"}'
```

---

### POST `/place`
Coloca un bloque en la posición especificada.

**Parámetros:**
- `x` (number, requerido): Coordenada X
- `y` (number, requerido): Coordenada Y
- `z` (number, requerido): Coordenada Z
- `blockName` (string, requerido): Nombre del bloque (ej: "stone", "dirt", "wood")

**Ejemplo:**
```bash
curl -X POST https://tu-servicio.onrender.com/place \
  -H "Content-Type: application/json" \
  -d '{"x": 64, "y": 70, "z": 230, "blockName": "stone"}'
```

---

### POST `/dig`
Mina/destruye un bloque en la posición especificada.

**Parámetros:**
- `x` (number, requerido): Coordenada X
- `y` (number, requerido): Coordenada Y
- `z` (number, requerido): Coordenada Z

**Ejemplo:**
```bash
curl -X POST https://tu-servicio.onrender.com/dig \
  -H "Content-Type: application/json" \
  -d '{"x": 64, "y": 70, "z": 230}'
```

---

### POST `/use`
Usa el item que el bot tiene en la mano.

**Ejemplo:**
```bash
curl -X POST https://tu-servicio.onrender.com/use \
  -H "Content-Type: application/json"
```

---

### GET `/inventory`
Obtiene el inventario completo del bot.

**Ejemplo:**
```bash
curl https://tu-servicio.onrender.com/inventory
```

**Respuesta:**
```json
{
  "items": [
    {
      "slot": 0,
      "name": "minecraft:dirt",
      "count": 64,
      "displayName": "Dirt"
    }
  ],
  "heldItem": {
    "name": "minecraft:stone",
    "count": 32
  }
}
```

## Ejemplos de Uso

### Mover el bot hacia adelante por 5 segundos
```bash
curl -X POST https://tu-servicio.onrender.com/move \
  -H "Content-Type: application/json" \
  -d '{"action": "forward", "duration": 5000}'
```

### Hacer que el bot salte
```bash
curl -X POST https://tu-servicio.onrender.com/move \
  -H "Content-Type: application/json" \
  -d '{"action": "jump", "duration": 500}'
```

### Verificar estado del bot
```bash
curl https://tu-servicio.onrender.com/status
```

## Notas

- Todos los endpoints requieren que el bot esté conectado
- Los endpoints devuelven errores JSON si el bot no está conectado o si hay problemas
- La API incluye CORS habilitado para uso desde navegadores
- Los tiempos están en milisegundos

