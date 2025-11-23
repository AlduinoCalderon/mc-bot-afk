# 🤖 Minecraft Bot API Service

API multi-bot para gestionar bots de Minecraft con interfaz web responsiva, WebSockets, y soporte para mundos locales (LAN/Hamachi).

## 🚀 Inicio Rápido

### Desarrollo Local

```bash
# Instalar dependencias
npm install

# Iniciar en modo desarrollo (con nodemon - auto-reload)
npm run dev
```

Abre `http://localhost:10000/` en tu navegador.

### Producción (Render)

```bash
npm start
```

Render automáticamente usa `npm start` y configura los health checks.

## 🎮 Conectarse a Mundos Locales

### Mundo Abierto a LAN

1. Abre tu mundo en Minecraft
2. ESC → "Abrir a LAN"
3. Anota el puerto (ej: 25565)
4. Obtén tu IP local: `ipconfig` (Windows) o `ifconfig` (Linux/Mac)
5. Crea un bot con:
   - **Servidor:** Tu IP local (ej: `192.168.1.100`)
   - **Puerto:** El puerto mostrado (ej: `25565`)

### Hamachi (Red Virtual)

1. Instala Hamachi en tu PC y en el PC del servidor
2. Crea/Únete a una red
3. Usa la IP de Hamachi (tipo `25.x.x.x` o `5.x.x.x`)
4. Abre el mundo a LAN
5. Crea el bot con la IP de Hamachi

## 📚 Documentación

- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Guía completa de desarrollo local
- **[API.md](./API.md)** - Documentación completa de la API

## ✨ Características

- ✅ Multi-bot support
- ✅ Interfaz web responsiva
- ✅ WebSockets para control en tiempo real
- ✅ Health checks para Render
- ✅ Soporte para mundos locales (LAN/Hamachi)
- ✅ Auto-reconnect
- ✅ Desarrollo con nodemon (auto-reload)

## 🛠️ Scripts Disponibles

- `npm run dev` - Desarrollo con nodemon (auto-reload)
- `npm start` - Producción
- `npm run prod` - Producción (alias)

## 📝 Variables de Entorno

- `PORT` - Puerto del servidor (default: 10000)
- `NODE_ENV` - Entorno (development/production)
- `MONITOR_SERVICES` - URLs de servicios para keep-awake (separadas por coma)

## 🔗 Endpoints Principales

- `GET /` - Interfaz web
- `GET /health` - Health check
- `GET /health/monitor` - Monitor para keep-awake
- `GET /ping` - Ping/pong
- `GET /bots` - Listar bots
- `POST /bots` - Crear bot
- `GET /bots/:id` - Estado del bot
- `DELETE /bots/:id` - Eliminar bot

Ver [API.md](./API.md) para documentación completa.

## 💡 Tips

- Usa `npm run dev` durante el desarrollo para ver cambios instantáneos
- La interfaz web se actualiza automáticamente
- Los bots se mantienen conectados durante el desarrollo
- Render usa automáticamente `/health` para health checks

