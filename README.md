# 🤖 Minecraft Bot Control Panel

Sistema de control de bots para Minecraft usando Mineflayer. Permite crear, gestionar y controlar múltiples bots de Minecraft desde una interfaz web moderna.

## 🌐 Servicio en Línea

**URL del Servicio:** [https://mc-aldobot.onrender.com](https://mc-aldobot.onrender.com)

**Health Check:** [https://mc-aldobot.onrender.com/health](https://mc-aldobot.onrender.com/health)

## ✨ Características

- 🎮 **Control Multi-Bot**: Gestiona múltiples bots simultáneamente
- 🌐 **Interfaz Web**: Panel de control moderno y responsive
- 🎯 **Teleoperación 3D**: Vista en primera persona con controles estilo Minecraft
- 📦 **Gestión de Inventario**: Ver y reorganizar items del bot
- 🔄 **Auto-Reconexión**: Reconexión automática en caso de desconexión
- 💾 **Persistencia**: Los bots se guardan automáticamente
- 📊 **Monitoreo**: Health checks y estadísticas en tiempo real

## 🚀 Inicio Rápido

### Instalación

```bash
npm install
```

### Desarrollo

```bash
npm run dev
```

### Producción

```bash
npm start
```

El servicio estará disponible en `http://localhost:10000`

## 📚 Documentación de API

La documentación completa de la API está disponible en formato OpenAPI:

- **OpenAPI Spec:** `openapi.json` (compatible con Swagger UI)

Puedes visualizar la documentación usando herramientas como:
- [Swagger Editor](https://editor.swagger.io/)
- [Swagger UI](https://swagger.io/tools/swagger-ui/)
- Extensiones de VS Code para OpenAPI

## 🛠️ Endpoints Principales

- `GET /health` - Health check del servicio
- `GET /ping` - Ping/pong
- `GET /bots` - Listar todos los bots
- `POST /bots` - Crear un nuevo bot
- `GET /bots/:id` - Obtener estado de un bot
- `DELETE /bots/:id` - Eliminar un bot
- `POST /bots/:id/move` - Controlar movimiento
- `GET /bots/:id/inventory` - Ver inventario
- `GET /bots/:id/world` - Obtener datos del mundo (teleoperación)

## 🎮 Teleoperación

El sistema incluye una vista 3D en primera persona que permite:

- **Pantalla Completa**: Modo pantalla completa para mejor experiencia
- **Controles Activables**: Botón para activar/desactivar controles
- **Controles Estilo Minecraft**: WASD, Espacio, Shift, Ctrl, Mouse
- **Inventario Interactivo**: Click para intercambiar items
- **Vista Simplificada**: Solo muestra bloques cercanos para mejor rendimiento

## 🔧 Configuración

### Variables de Entorno

- `PORT`: Puerto del servidor (default: 10000)
- `NODE_ENV`: Entorno (development/production)
- `MONITOR_SERVICES`: URLs de servicios a monitorear (separadas por comas)

### Ejemplo

```bash
PORT=10000
NODE_ENV=production
MONITOR_SERVICES=https://service1.onrender.com/health,https://service2.onrender.com/health
```

## 📁 Estructura del Proyecto

```
mc-bot-afk/
├── models/           # Modelos de datos
├── controllers/      # Controladores HTTP
├── services/         # Servicios de negocio
├── routes/           # Rutas y enrutamiento
├── utils/            # Utilidades
├── public/           # Archivos estáticos (interfaz web)
└── index.js         # Punto de entrada
```

## 🐛 Solución de Problemas

Para problemas comunes, consulta [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## 📝 Licencia

MIT

## 🔗 Enlaces

- **Servicio:** https://mc-aldobot.onrender.com
- **Health Check:** https://mc-aldobot.onrender.com/health
- **API Docs:** Ver `openapi.json`
