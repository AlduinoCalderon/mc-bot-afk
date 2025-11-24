# Troubleshooting - Problemas Comunes

## Problema: WebSocket se desconecta constantemente

### Soluciones aplicadas:
1. ✅ Mejorado el manejo de errores en el parseo de mensajes JSON
2. ✅ Agregado logging detallado de desconexiones
3. ✅ Mejorado el sistema de reconexión automática
4. ✅ Prevención de múltiples conexiones simultáneas

### Verificaciones:
- Abre la consola del navegador (F12) y revisa los mensajes de error
- Verifica que la URL del WebSocket sea correcta (debe ser `wss://` en HTTPS)
- Revisa los logs del servidor en Render

## Problema: Vista 3D no se carga o se cierra

### Soluciones aplicadas:
1. ✅ Verificación de que Three.js se carga correctamente
2. ✅ Manejo de errores en la inicialización de la escena 3D
3. ✅ Validación de datos antes de renderizar

### Verificaciones:
- Abre la consola del navegador (F12) y busca errores de Three.js
- Verifica que el CDN de Three.js esté accesible
- Asegúrate de que el bot esté conectado antes de activar la vista 3D

## Problema: No puedo acceder a la aplicación

### Posibles causas:
1. **Servicio dormido (plan gratuito)**: Render duerme servicios después de 15 min de inactividad
   - Solución: Usa el endpoint `/health/monitor` para mantenerlo despierto
   
2. **Error en el servidor**: Revisa los logs en Render Dashboard
   - Ve a: Dashboard → Tu servicio → Logs

3. **Problema de CORS o WebSocket**: Verifica la configuración del servidor

## Cómo revisar logs en Render

1. Ve a [Render Dashboard](https://dashboard.render.com)
2. Selecciona tu servicio
3. Ve a la pestaña "Logs"
4. Busca errores relacionados con:
   - WebSocket connections
   - Bot connections
   - Memory errors
   - Timeout errors

## Endpoints de diagnóstico

- `GET /health` - Verifica que el servidor esté funcionando
- `GET /ping` - Verifica conectividad básica
- `GET /bots` - Lista todos los bots (verifica que el servidor responda)

## Errores comunes en consola del navegador

### "WebSocket connection failed"
- Verifica que el servidor esté corriendo
- Verifica que uses `wss://` en HTTPS y `ws://` en HTTP
- Revisa los logs del servidor

### "Three.js is not defined"
- El CDN de Three.js no se cargó
- Verifica tu conexión a internet
- Recarga la página

### "Bot not connected"
- El bot no está conectado al servidor de Minecraft
- Verifica la conexión del bot en el panel de control
- Revisa los logs del servidor para errores de conexión del bot

