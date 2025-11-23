# Despliegue en Render

## Configuración Rápida

1. **Conecta tu repositorio a Render:**
   - Ve a [Render Dashboard](https://dashboard.render.com)
   - Click en "New" → "Web Service"
   - Conecta tu repositorio de GitHub/GitLab

2. **Configuración del Servicio:**
   - **Name:** `mc-bot-afk`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** `Starter` (o el que prefieras)

3. **Variables de Entorno:**
   - `NODE_ENV` = `production`
   - `PORT` = (Render lo establece automáticamente, no necesitas configurarlo)
   - `MONITOR_SERVICES` = (opcional) URLs de otros servicios para keep-awake, separadas por comas

4. **Despliegue:**
   - Render detectará automáticamente el `package.json`
   - El servicio se desplegará automáticamente

## Endpoints Importantes

Una vez desplegado, tendrás acceso a:

- **Web Interface:** `https://tu-servicio.onrender.com/`
- **Health:** `https://tu-servicio.onrender.com/health`
- **Monitor (Keep-Awake):** `https://tu-servicio.onrender.com/health/monitor`
- **Ping:** `https://tu-servicio.onrender.com/ping`

## Keep-Awake Automático

El servicio se mantiene despierto automáticamente mediante:
- El endpoint `/health/monitor` que puedes configurar en otros servicios
- El endpoint `/ping` para verificaciones simples

## Notas Importantes

- Los archivos `bots-data.json` y `servers-history.json` se crean automáticamente
- Los datos se pierden si el servicio se reinicia (considera usar una base de datos para producción)
- El servicio se "duerme" después de 15 minutos de inactividad en el plan gratuito
- Usa el endpoint `/health/monitor` para mantenerlo despierto

## Troubleshooting

- Si el servicio no inicia, revisa los logs en Render Dashboard
- Verifica que `NODE_ENV=production` esté configurado
- Asegúrate de que el puerto esté usando `process.env.PORT` (ya está configurado)

