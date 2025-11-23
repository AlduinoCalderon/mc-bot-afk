# 🛠️ Guía de Desarrollo Local

Esta guía te ayudará a configurar el proyecto para desarrollo local con nodemon y conectarte a mundos locales de Minecraft (LAN/Hamachi).

## 📋 Requisitos Previos

- Node.js >= 22.0.0
- Minecraft servidor local o mundo abierto a LAN
- (Opcional) Hamachi para conexiones remotas

## 🚀 Configuración Inicial

### 1. Instalar Dependencias

```bash
npm install
```

Esto instalará todas las dependencias incluyendo `nodemon` para desarrollo.

### 2. Modos de Ejecución

#### Desarrollo Local (con nodemon - auto-reload)

```bash
npm run dev
```

**Características:**
- ✅ Auto-reload cuando cambias archivos
- ✅ Watch en `index.js` y carpeta `public`
- ✅ Delay de 1 segundo para evitar múltiples recargas
- ✅ Ignora `node_modules` y `bots-data.json`

#### Producción

```bash
npm start
# o
npm run prod
```

## 🎮 Conectarse a Mundos Locales

### Opción 1: Mundo Abierto a LAN (Mismo Router)

1. **Abre tu mundo en Minecraft**
2. **Presiona ESC → "Abrir a LAN"**
3. **Anota el puerto** (ej: 25565, 25566, etc.)
4. **Obtén tu IP local:**
   - Windows: `ipconfig` → Busca "IPv4 Address"
   - Linux/Mac: `ifconfig` o `ip addr`
   - Ejemplo: `192.168.1.100`

5. **Crea un bot usando la API o la interfaz web:**
   ```json
   {
     "name": "LocalBot",
     "serverHost": "192.168.1.100",
     "serverPort": 25565,
     "version": "1.21"
   }
   ```

### Opción 2: Hamachi (Red Virtual)

1. **Instala Hamachi** en tu PC y en el PC del servidor
2. **Crea/Únete a una red** en Hamachi
3. **Obtén la IP de Hamachi:**
   - En Hamachi, verás una IP tipo `25.x.x.x` o `5.x.x.x`
   - Esta es la IP que debes usar

4. **Abre el mundo a LAN** en el servidor
5. **Crea el bot con la IP de Hamachi:**
   ```json
   {
     "name": "HamachiBot",
     "serverHost": "25.123.45.67",  // IP de Hamachi
     "serverPort": 25565,
     "version": "1.21"
   }
   ```

### Opción 3: Servidor Local (localhost)

Si estás ejecutando un servidor de Minecraft en la misma máquina:

```json
{
  "name": "LocalhostBot",
  "serverHost": "localhost",
  "serverPort": 25565,
  "version": "1.21"
}
```

## 🔍 Detectar Servidores en la Red Local

### Método Manual

1. **Encuentra tu IP local:**
   ```bash
   # Windows
   ipconfig
   
   # Linux/Mac
   ifconfig
   # o
   ip addr
   ```

2. **Escanea el rango de IPs:**
   - Si tu IP es `192.168.1.100`
   - Prueba: `192.168.1.1` hasta `192.168.1.254`
   - O usa la herramienta de descubrimiento de Minecraft

### Método: Usar la Interfaz Web

1. Abre `http://localhost:10000/`
2. En el formulario de crear bot, prueba diferentes IPs:
   - Tu IP local
   - IPs de otros dispositivos en la red
   - IP de Hamachi si estás usando VPN

## 🌐 Configuración para Render (Producción)

### Variables de Entorno en Render

Cuando despliegues en Render, configura:

```bash
PORT=10000  # Render lo asigna automáticamente
MONITOR_SERVICES=https://otro-servicio.onrender.com
NODE_ENV=production
```

### Health Checks en Render

Render automáticamente usa el endpoint `/health` para verificar que el servicio está funcionando.

**Configuración recomendada en Render:**
- **Health Check Path:** `/health`
- **Health Check Interval:** 60 segundos
- **Timeout:** 30 segundos

## 📝 Ejemplos de Uso

### Crear Bot vía API (cURL)

```bash
curl -X POST http://localhost:10000/bots \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MiBotLocal",
    "serverHost": "192.168.1.100",
    "serverPort": 25565,
    "version": "1.21"
  }'
```

### Crear Bot desde la Interfaz Web

1. Abre `http://localhost:10000/`
2. Completa el formulario:
   - **Nombre:** MiBotLocal
   - **Servidor:** 192.168.1.100 (tu IP local)
   - **Puerto:** 25565 (puerto del mundo LAN)
   - **Versión:** 1.21
3. Click en "Crear Bot"

## 🐛 Solución de Problemas

### El bot no se conecta

1. **Verifica que el mundo esté abierto a LAN:**
   - En Minecraft: ESC → "Abrir a LAN" debe estar activo

2. **Verifica el firewall:**
   - Windows: Permite Java/Minecraft a través del firewall
   - Asegúrate que el puerto esté abierto

3. **Verifica la IP:**
   - Usa `ipconfig` para obtener tu IP real
   - No uses `127.0.0.1` a menos que el servidor esté en la misma máquina

4. **Verifica el puerto:**
   - El puerto mostrado al abrir a LAN puede ser diferente a 25565
   - Usa exactamente el puerto que muestra Minecraft

### Error "Connection refused"

- El servidor no está escuchando en esa IP/puerto
- Verifica que el mundo esté abierto a LAN
- Verifica que no haya firewall bloqueando

### Error "Connection timeout"

- La IP es incorrecta
- El servidor está en otra red (usa Hamachi)
- El puerto es incorrecto

### Nodemon no detecta cambios

- Verifica que `nodemon.json` esté en la raíz del proyecto
- Reinicia nodemon: `Ctrl+C` y luego `npm run dev`
- Verifica que los archivos estén en las rutas correctas

## 🔄 Flujo de Trabajo Recomendado

1. **Desarrollo:**
   ```bash
   npm run dev
   ```
   - Abre `http://localhost:10000/`
   - Crea bots de prueba
   - Los cambios se recargan automáticamente

2. **Pruebas Locales:**
   - Abre tu mundo en Minecraft
   - Ábrelo a LAN
   - Crea un bot con tu IP local
   - Prueba los controles

3. **Producción (Render):**
   ```bash
   npm start
   ```
   - Render usa automáticamente `npm start`
   - Los health checks funcionan automáticamente
   - No necesitas configurar nada extra

## 📚 Recursos Adicionales

- [Documentación de Mineflayer](https://github.com/PrismarineJS/mineflayer)
- [Guía de Hamachi](https://www.vpn.net/)
- [Render Documentation](https://render.com/docs)

## 💡 Tips

- **IPs Privadas Comunes:**
  - `192.168.x.x` - Redes domésticas
  - `10.x.x.x` - Redes corporativas
  - `172.16.x.x` - Redes privadas
  - `25.x.x.x` o `5.x.x.x` - Hamachi

- **Puertos Comunes:**
  - `25565` - Puerto por defecto de Minecraft
  - `25566`, `25567`, etc. - Puertos alternativos cuando 25565 está ocupado

- **Desarrollo Rápido:**
  - Usa `npm run dev` para ver cambios instantáneos
  - La interfaz web se actualiza automáticamente
  - Los bots se mantienen conectados durante el desarrollo

