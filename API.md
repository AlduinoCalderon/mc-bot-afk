# Minecraft Bot API - Documentation

A multi-bot API service for managing Minecraft bots with health monitoring, keep-awake functionality, and individual bot control.

## Features

- **Multi-Bot Support**: Create and manage multiple bots simultaneously
- **Health Monitoring**: Keep-awake endpoints for self and other Render services
- **Ping/Pong**: Simple health check endpoint
- **Bot Management**: Create, list, get, and delete bots via API
- **Individual Bot Control**: Control each bot independently via unique IDs
- **Local Storage**: Persistent bot data stored in `bots-data.json`
- **Auto-Reconnect**: Automatic reconnection on disconnect

## Base Endpoints

### GET `/`
Get API information and available endpoints.

**Response:**
```json
{
  "status": "active",
  "message": "Minecraft Bot API Service",
  "version": "2.0.0",
  "endpoints": { ... },
  "stats": {
    "totalBots": 2,
    "connectedBots": 1
  }
}
```

---

### GET `/health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600,
  "bots": {
    "total": 2,
    "connected": 1,
    "disconnected": 0,
    "reconnecting": 1
  }
}
```

---

### GET `/health/monitor`
Keep-awake monitor endpoint. Monitors self and other configured services.

**Environment Variable:** `MONITOR_SERVICES` (comma-separated URLs)

**Example:** `MONITOR_SERVICES=https://service1.onrender.com,https://service2.onrender.com`

**Response:**
```json
{
  "status": "monitoring",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "services": [
    {
      "service": "self",
      "url": "http://localhost:10000",
      "status": "healthy",
      "timestamp": "2024-01-01T12:00:00.000Z"
    },
    {
      "service": "https://service1.onrender.com",
      "url": "https://service1.onrender.com",
      "status": "healthy",
      "httpStatus": 200,
      "timestamp": "2024-01-01T12:00:00.000Z"
    }
  ],
  "summary": {
    "total": 2,
    "healthy": 2,
    "unhealthy": 0
  }
}
```

---

### GET `/ping`
Ping endpoint (returns pong).

**Response:**
```json
{
  "pong": true,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

---

## Bot Management Endpoints

### GET `/bots`
List all bots.

**Response:**
```json
{
  "bots": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "MyBot",
      "connected": true,
      "status": "connected",
      "username": "MyBot",
      "position": { "x": "63.52", "y": "190.31", "z": "230.66" },
      "health": 20,
      "food": 20,
      "gameMode": "survival",
      "ping": 45,
      "serverHost": "example.com",
      "serverPort": 25565,
      "version": "1.21",
      "createdAt": "2024-01-01T10:00:00.000Z",
      "lastConnected": "2024-01-01T12:00:00.000Z",
      "connectedCount": 5
    }
  ],
  "count": 1,
  "connected": 1
}
```

---

### POST `/bots`
Create a new bot.

**Request Body:**
```json
{
  "name": "MyBot",
  "serverHost": "example.com",
  "serverPort": 25565,
  "username": "MyBot",
  "version": "1.21",
  "authKey": null
}
```

**Required Fields:**
- `name`: Bot name
- `serverHost`: Server hostname or IP

**Optional Fields:**
- `serverPort`: Server port (default: 25565)
- `username`: Bot username (default: same as name)
- `version`: Minecraft version (default: "1.21")
- `authKey`: Authentication key for cracked servers (future use)

**Response:**
```json
{
  "success": true,
  "bot": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "MyBot",
    "connected": false,
    "status": "disconnected",
    "serverHost": "example.com",
    "serverPort": 25565,
    "version": "1.21",
    "createdAt": "2024-01-01T12:00:00.000Z"
  },
  "controlUrl": "/bots/550e8400-e29b-41d4-a716-446655440000"
}
```

---

### GET `/bots/:id`
Get specific bot status.

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "MyBot",
  "connected": true,
  "status": "connected",
  "username": "MyBot",
  "position": { "x": "63.52", "y": "190.31", "z": "230.66" },
  "health": 20,
  "food": 20,
  "gameMode": "survival",
  "ping": 45,
  "serverHost": "example.com",
  "serverPort": 25565,
  "version": "1.21",
  "createdAt": "2024-01-01T10:00:00.000Z",
  "lastConnected": "2024-01-01T12:00:00.000Z",
  "connectedCount": 5
}
```

---

### DELETE `/bots/:id`
Delete a bot.

**Response:**
```json
{
  "success": true,
  "message": "Bot deleted"
}
```

---

## Bot Control Endpoints

All bot control endpoints require the bot to be connected.

### POST `/bots/:id/move`
Control bot movement.

**Request Body:**
```json
{
  "action": "forward",
  "duration": 2000
}
```

**Actions:** `forward`, `back`, `left`, `right`, `jump`, `sprint`, `sneak`

**Response:**
```json
{
  "success": true,
  "action": "forward",
  "duration": 2000
}
```

---

### POST `/bots/:id/look`
Control bot look direction.

**Request Body:**
```json
{
  "yaw": 1.57,
  "pitch": 0
}
```

**Response:**
```json
{
  "success": true,
  "yaw": 1.57,
  "pitch": 0
}
```

---

### POST `/bots/:id/chat`
Send chat message.

**Request Body:**
```json
{
  "message": "Hello from API!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Hello from API!"
}
```

---

### POST `/bots/:id/attack`
Attack nearest entity.

**Response:**
```json
{
  "success": true,
  "target": "zombie",
  "distance": "3.45"
}
```

---

### GET `/bots/:id/inventory`
Get bot inventory.

**Response:**
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

---

### POST `/bots/:id/place`
Place a block.

**Request Body:**
```json
{
  "x": 64,
  "y": 70,
  "z": 230,
  "blockName": "stone"
}
```

**Response:**
```json
{
  "success": true,
  "position": { "x": 64, "y": 70, "z": 230 },
  "block": "stone"
}
```

---

### POST `/bots/:id/dig`
Dig/destroy a block.

**Request Body:**
```json
{
  "x": 64,
  "y": 70,
  "z": 230
}
```

**Response:**
```json
{
  "success": true,
  "position": { "x": 64, "y": 70, "z": 230 }
}
```

---

### POST `/bots/:id/use`
Use item in hand.

**Response:**
```json
{
  "success": true,
  "message": "Item activated"
}
```

---

## Usage Examples

### Create a Bot
```bash
curl -X POST http://localhost:10000/bots \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TestBot",
    "serverHost": "example.com",
    "serverPort": 25565,
    "version": "1.21"
  }'
```

### List All Bots
```bash
curl http://localhost:10000/bots
```

### Get Bot Status
```bash
curl http://localhost:10000/bots/550e8400-e29b-41d4-a716-446655440000
```

### Make Bot Jump
```bash
curl -X POST http://localhost:10000/bots/550e8400-e29b-41d4-a716-446655440000/move \
  -H "Content-Type: application/json" \
  -d '{"action": "jump", "duration": 500}'
```

### Health Check
```bash
curl http://localhost:10000/health
```

### Monitor Services (Keep-Awake)
```bash
curl http://localhost:10000/health/monitor
```

### Ping
```bash
curl http://localhost:10000/ping
```

## Environment Variables

- `PORT`: HTTP server port (default: 10000)
- `MONITOR_SERVICES`: Comma-separated list of service URLs to monitor (optional)

## Data Storage

Bot data is stored locally in `bots-data.json`. This file contains:
- Bot IDs and configurations
- Connection status
- Connection count
- Last connected timestamp

## Notes

- All endpoints return JSON
- CORS is enabled for all origins
- Bots automatically reconnect on disconnect
- Each bot has a unique UUID for identification
- Bot data persists across restarts via `bots-data.json`
