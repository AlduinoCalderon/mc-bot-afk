# Configuración de Health Checks en Render

## Endpoints Disponibles

Tu servicio tiene los siguientes endpoints de health check:

1. **`/health`** - Health check básico del servicio
   - URL: `https://mc-aldobot.onrender.com/health`
   - Retorna: Estado del servicio, uptime, y estadísticas de bots

2. **`/health/monitor`** - Monitor que mantiene despiertos múltiples servicios
   - URL: `https://mc-aldobot.onrender.com/health/monitor`
   - Monitorea el servicio actual + otros servicios configurados en `MONITOR_SERVICES`

## Configuración en Render Dashboard

### 1. Health Check Path (Configuración del Servicio)

1. Ve a tu servicio en Render Dashboard: `mc-AldoBot`
2. Ve a la sección **Settings** (Configuración)
3. Busca **Health Check Path**
4. Configura:
   ```
   /health
   ```
5. Guarda los cambios

**Nota:** Render automáticamente llamará a este endpoint cada cierto tiempo para verificar que el servicio está funcionando.

### 2. Variables de Entorno

Ve a la sección **Environment** (Entorno) en tu servicio y agrega:

#### Variable: `MONITOR_SERVICES`

**Valor:**
```
https://meli-ecommerce-staging.onrender.com/api/v1/health,https://mc-aldobot.onrender.com/health
```

**Descripción:** Lista de URLs separadas por comas que el endpoint `/health/monitor` verificará periódicamente para mantenerlos despiertos.

**Formato:** URLs separadas por comas, sin espacios

**Ejemplo completo:**
```
Key: MONITOR_SERVICES
Value: https://meli-ecommerce-staging.onrender.com/api/v1/health,https://mc-aldobot.onrender.com/health
```

### 3. Configurar Cron Job para Keep-Awake (Opcional)

Si quieres que el servicio se mantenga despierto automáticamente, puedes crear un Cron Job en Render:

1. Ve a **Cron Jobs** en tu dashboard de Render
2. Crea un nuevo Cron Job con:
   - **Name:** `Keep-Awake Monitor`
   - **Schedule:** `*/5 * * * *` (cada 5 minutos)
   - **Command:** 
     ```bash
     curl https://mc-aldobot.onrender.com/health/monitor
     ```
   - **Service:** Selecciona `mc-AldoBot`

Esto hará que cada 5 minutos se llame al endpoint `/health/monitor`, que a su vez verificará todos los servicios configurados en `MONITOR_SERVICES`.

## Lista de Variables de Entorno Necesarias

### Variable Requerida:

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `MONITOR_SERVICES` | `https://meli-ecommerce-staging.onrender.com/api/v1/health,https://mc-aldobot.onrender.com/health` | URLs de servicios a monitorear (separadas por comas) |

### Variables Opcionales (ya configuradas por Render):

- `PORT` - Puerto del servicio (Render lo configura automáticamente)
- `NODE_ENV` - Entorno (production/development)

## Verificación

Después de configurar, puedes verificar que funciona:

1. **Health Check básico:**
   ```bash
   curl https://mc-aldobot.onrender.com/health
   ```
   Debe retornar:
   ```json
   {
     "status": "healthy",
     "timestamp": "...",
     "uptime": ...,
     "bots": { ... }
   }
   ```

2. **Monitor endpoint:**
   ```bash
   curl https://mc-aldobot.onrender.com/health/monitor
   ```
   Debe retornar el estado de todos los servicios configurados.

## Notas Importantes

- El endpoint `/health` debe responder con status 200 para que Render considere el servicio como saludable
- El endpoint `/health/monitor` hace peticiones HTTP a los servicios configurados cada vez que se llama
- Si un servicio en `MONITOR_SERVICES` no responde, aparecerá como `unhealthy` en el reporte pero no afectará el servicio principal
- Los servicios gratuitos de Render se "duermen" después de 15 minutos de inactividad, por eso es importante el keep-awake

## URLs de Referencia

- **Tu servicio:** https://mc-aldobot.onrender.com
- **Health endpoint:** https://mc-aldobot.onrender.com/health
- **Monitor endpoint:** https://mc-aldobot.onrender.com/health/monitor
- **Otro servicio a monitorear:** https://meli-ecommerce-staging.onrender.com/api/v1/health

