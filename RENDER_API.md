# 🔑 Acceso a Render mediante API

## Obtener tu API Key de Render

1. Ve a [Render Dashboard](https://dashboard.render.com)
2. Haz clic en tu perfil (esquina superior derecha)
3. Selecciona **"Account Settings"**
4. Ve a la sección **"API Keys"**
5. Haz clic en **"Create API Key"**
6. Copia la clave (comienza con `rnd_`)

⚠️ **Importante**: Cada API key está asociada a un **workspace/espacio de trabajo** específico. Si cambias de workspace, necesitas crear una nueva API key.

## Configurar el Workspace en Render MCP

Si estás usando Render MCP (Model Context Protocol), necesitas:

1. **Listar los workspaces disponibles:**
   ```bash
   # Usando MCP Render tools
   mcp_render_list_workspaces
   ```

2. **Seleccionar el workspace correcto:**
   ```bash
   # Usando MCP Render tools
   mcp_render_select_workspace --ownerID "TU_OWNER_ID"
   ```

3. **Verificar el workspace seleccionado:**
   ```bash
   mcp_render_get_selected_workspace
   ```

## Acceder a Logs mediante API

### Opción 1: Usando Render Dashboard (Recomendado)

1. Ve a [Render Dashboard](https://dashboard.render.com)
2. Selecciona tu servicio
3. Ve a la pestaña **"Logs"**
4. Los logs se muestran en tiempo real

### Opción 2: Usando Render API directamente

```bash
# Obtener logs de un servicio
curl -H "Authorization: Bearer rnd_TU_API_KEY" \
  "https://api.render.com/v1/services/TU_SERVICE_ID/logs"
```

### Opción 3: Usando Render MCP Tools

Si tienes configurado Render MCP, puedes usar:

```javascript
// Listar servicios
mcp_render_list_services()

// Obtener logs de un servicio específico
mcp_render_list_logs({
  resource: "TU_SERVICE_ID",
  startTime: "2024-01-01T00:00:00Z",
  endTime: "2024-01-01T23:59:59Z",
  limit: 100
})
```

## Cambiar de Workspace

Si cambiaste de workspace y tu API key anterior no funciona:

1. **Crea una nueva API key** en el nuevo workspace
2. **Actualiza la configuración** donde uses la API key
3. **Selecciona el nuevo workspace** usando `mcp_render_select_workspace`

## Variables de Entorno para API Key

Si necesitas usar la API key en tu aplicación:

```bash
# En Render Dashboard → Environment Variables
RENDER_API_KEY=rnd_TU_API_KEY_AQUI
```

⚠️ **No commits la API key** en el código. Úsala solo como variable de entorno.

## Acceder a Logs del Servicio mc-bot-afk

### Método 1: Usando Render Dashboard (Más fácil)

1. Ve a [Render Dashboard](https://dashboard.render.com)
2. Busca el servicio **"mc-bot-afk"** en la lista
3. Haz clic en el servicio
4. Ve a la pestaña **"Logs"**
5. Los logs se muestran en tiempo real

### Método 2: Usando Render MCP (Programático)

Si tienes configurado Render MCP con tu API key:

```javascript
// 1. Listar workspaces
mcp_render_list_workspaces()

// 2. Seleccionar workspace (si hay múltiples)
mcp_render_select_workspace({ ownerID: "tea-xxxxx" })

// 3. Listar servicios para encontrar el ID del servicio
mcp_render_list_services()

// 4. Obtener logs del servicio
mcp_render_list_logs({
  resource: "srv-xxxxx", // ID del servicio mc-bot-afk
  limit: 100,
  direction: "backward" // logs más recientes primero
})
```

### Método 3: Usando cURL con API Key

```bash
# Primero obtén el Service ID desde el Dashboard
# Luego:
curl -H "Authorization: Bearer rnd_TU_API_KEY" \
  "https://api.render.com/v1/services/srv-XXXXX/logs?limit=100"
```

## Solución de Problemas

### "Invalid API key" o "Unauthorized"
- Verifica que la API key sea correcta
- Asegúrate de estar en el workspace correcto
- La API key puede haber expirado (crea una nueva)
- **Si cambiaste de workspace**: Necesitas crear una nueva API key en el nuevo workspace

### "Workspace not found"
- Lista los workspaces disponibles usando `mcp_render_list_workspaces`
- Selecciona el workspace correcto antes de hacer operaciones
- Verifica que la API key pertenezca al workspace correcto

### No puedo ver los logs
- Verifica que tengas permisos en el workspace
- Asegúrate de que el servicio esté desplegado
- Revisa que la API key tenga los permisos necesarios
- **Si el servicio no aparece**: Puede estar en otro workspace, lista todos los workspaces

### El servicio mc-bot-afk no aparece en la lista
- El servicio puede estar en otro workspace
- Verifica todos los workspaces disponibles
- El servicio puede tener otro nombre
- Revisa el Dashboard de Render directamente

## Referencias

- [Render API Documentation](https://render.com/docs/api)
- [Render Dashboard](https://dashboard.render.com)
- [Render MCP Documentation](https://github.com/renderinc/mcp-render)

