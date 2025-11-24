# 🔑 Gestión de API Keys de Render

## 📁 Archivos

- **`render-api-keys.json`** - Archivo local con tus API keys (NO se sube a git)
- **`render-api-keys.example.json`** - Plantilla de ejemplo (SÍ se sube a git)

## 🚀 Uso Rápido

### 1. Configurar tu primera API key

```bash
# Copia el ejemplo
cp render-api-keys.example.json render-api-keys.json

# Edita el archivo con tus datos
```

### 2. Agregar una nueva API key

Edita `render-api-keys.json` y agrega un nuevo workspace:

```json
{
  "workspaces": {
    "mi-nuevo-workspace": {
      "name": "Mi Nuevo Workspace",
      "workspaceId": "tea-XXXXX",
      "apiKey": "rnd_TU_NUEVA_API_KEY",
      "description": "Workspace para producción",
      "lastUpdated": "2024-11-23"
    }
  },
  "currentWorkspace": "mi-nuevo-workspace"
}
```

### 3. Cambiar entre workspaces

Simplemente actualiza `currentWorkspace` en el archivo:

```json
{
  "currentWorkspace": "nombre-del-workspace-activo"
}
```

## 📋 Estructura del Archivo

```json
{
  "workspaces": {
    "nombre-workspace": {
      "name": "Nombre legible",
      "workspaceId": "tea-XXXXX",
      "email": "email@example.com",
      "apiKey": "rnd_XXXXX",
      "description": "Descripción",
      "lastUpdated": "2024-11-23",
      "services": [
        {
          "name": "nombre-servicio",
          "serviceId": "srv-XXXXX",
          "url": "https://servicio.onrender.com",
          "status": "active"
        }
      ]
    }
  },
  "currentWorkspace": "nombre-workspace-activo"
}
```

## 🔍 Obtener IDs de Workspace y Servicio

### Workspace ID
1. Ve a [Render Dashboard](https://dashboard.render.com)
2. El ID está en la URL o usa `mcp_render_list_workspaces`

### Service ID
1. Ve a tu servicio en Render Dashboard
2. El ID está en la URL: `dashboard.render.com/web/srv-XXXXX`
3. O usa `mcp_render_list_services` después de seleccionar el workspace

## ⚠️ Seguridad

- ✅ **SÍ se sube a git**: `render-api-keys.example.json`
- ❌ **NO se sube a git**: `render-api-keys.json` (está en `.gitignore`)
- 🔒 **Mantén seguro**: No compartas `render-api-keys.json`
- 🔄 **Backup**: Considera hacer backup del archivo en un lugar seguro

## 🛠️ Scripts Útiles

### Leer la API key actual (Node.js)

```javascript
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('render-api-keys.json'));
const current = config.workspaces[config.currentWorkspace];
console.log('API Key actual:', current.apiKey);
```

### Cambiar workspace (Node.js)

```javascript
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('render-api-keys.json'));
config.currentWorkspace = 'nuevo-workspace';
fs.writeFileSync('render-api-keys.json', JSON.stringify(config, null, 2));
```

## 📝 Historial de Cambios

Mantén un registro de cuándo cambias las API keys:

```json
{
  "workspaces": {
    "workspace-actual": {
      "apiKey": "rnd_NUEVA_KEY",
      "lastUpdated": "2024-11-23",
      "previousKeys": [
        {
          "key": "rnd_ANTIGUA_KEY",
          "changed": "2024-11-20",
          "reason": "Cambio de workspace"
        }
      ]
    }
  }
}
```

## 🔗 Referencias

- [Render API Documentation](https://render.com/docs/api)
- [Render Dashboard](https://dashboard.render.com)
- Ver también: `RENDER_API.md` para más detalles sobre uso de la API

