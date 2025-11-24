// WebSocket connection
let ws = null;
let reconnectInterval = null;
let currentBotId = null;

// Initialize WebSocket connection
function initWebSocket() {
    // Close existing connection if any
    if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    console.log('Connecting to WebSocket:', wsUrl);
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('WebSocket connected');
        updateWSStatus(true);
        clearInterval(reconnectInterval);
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (err) {
            console.error('Error parsing WebSocket message:', err, event.data);
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateWSStatus(false);
    };
    
    ws.onclose = (event) => {
        console.log('WebSocket disconnected', event.code, event.reason);
        updateWSStatus(false);
        // Clear any existing reconnect interval
        if (reconnectInterval) {
            clearInterval(reconnectInterval);
        }
        // Attempt to reconnect after 3 seconds
        reconnectInterval = setInterval(() => {
            console.log('Attempting to reconnect WebSocket...');
            initWebSocket();
        }, 3000);
    };
}

function updateWSStatus(connected) {
    const statusEl = document.getElementById('ws-status');
    if (connected) {
        statusEl.textContent = 'Conectado';
        statusEl.className = 'status-badge connected';
    } else {
        statusEl.textContent = 'Desconectado';
        statusEl.className = 'status-badge disconnected';
    }
}

function sendWebSocketMessage(type, data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, ...data }));
    } else {
        // Fallback to HTTP API
        console.warn('WebSocket not available, using HTTP fallback');
    }
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'bot_status':
            updateBotStatus(data.botId, data.status);
            break;
        case 'bot_created':
            loadBots();
            break;
        case 'bot_deleted':
            loadBots();
            if (data.botId === currentBotId) {
                closeBotModal();
            }
            break;
        case 'world_data':
            // Handle world data for teleoperation
            if (teleopActive && data.botId === teleopBotId) {
                updateTeleopWorld(data);
            }
            break;
        case 'error':
            alert(`Error: ${data.message}`);
            break;
        default:
            console.log('Unknown message type:', data.type);
    }
}

// Load bots from API
async function loadBots() {
    try {
        const response = await fetch('/bots');
        const data = await response.json();
        displayBots(data.bots);
    } catch (error) {
        console.error('Error loading bots:', error);
    }
}

function displayBots(bots) {
    const container = document.getElementById('bots-container');
    const noBots = document.getElementById('no-bots');
    
    if (bots.length === 0) {
        container.style.display = 'none';
        noBots.style.display = 'block';
        return;
    }
    
    container.style.display = 'grid';
    noBots.style.display = 'none';
    container.innerHTML = '';
    
    bots.forEach(bot => {
        const botCard = createBotCard(bot);
        container.appendChild(botCard);
    });
}

function createBotCard(bot) {
    const card = document.createElement('div');
    card.className = `bot-card ${bot.connected ? 'connected' : 'disconnected'}`;
    card.onclick = () => openBotModal(bot.id);
    
    const statusClass = bot.connected ? 'connected' : (bot.status === 'reconnecting' ? 'reconnecting' : 'disconnected');
    
    card.innerHTML = `
        <div class="bot-card-header">
            <div class="bot-name">${bot.name}</div>
            <div class="bot-status ${statusClass}">${bot.status}</div>
        </div>
        <div class="bot-info">
            <div class="bot-info-item">
                <span class="bot-info-label">Servidor:</span>
                <span>${bot.serverHost}:${bot.serverPort}</span>
            </div>
            <div class="bot-info-item">
                <span class="bot-info-label">Versión:</span>
                <span>${bot.version}</span>
            </div>
            ${bot.connected ? `
                <div class="bot-info-item">
                    <span class="bot-info-label">Salud:</span>
                    <span>${bot.health || 0}/20</span>
                </div>
                <div class="bot-info-item">
                    <span class="bot-info-label">Posición:</span>
                    <span>${bot.position ? `${bot.position.x}, ${bot.position.y}, ${bot.position.z}` : 'N/A'}</span>
                </div>
            ` : ''}
            <div class="bot-info-item">
                <span class="bot-info-label">Conexiones:</span>
                <span>${bot.connectedCount || 0}</span>
            </div>
        </div>
    `;
    
    return card;
}

// Create bot form
document.getElementById('create-bot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const botData = {
        name: formData.get('name'),
        serverHost: formData.get('serverHost'),
        serverPort: parseInt(formData.get('serverPort')) || 25565,
        username: formData.get('username') || formData.get('name'),
        version: formData.get('version') || '1.21'
    };
    
    try {
        const response = await fetch('/bots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(botData)
        });
        
        if (response.ok) {
            const result = await response.json();
            alert(`Bot creado: ${result.bot.name}`);
            e.target.reset();
            loadBots();
            sendWebSocketMessage('bot_created', { botId: result.bot.id });
        } else {
            const error = await response.json();
            alert(`Error: ${error.error}`);
        }
    } catch (error) {
        console.error('Error creating bot:', error);
        alert('Error al crear el bot');
    }
});

// Refresh bots
document.getElementById('refresh-bots').addEventListener('click', loadBots);

// Bot Modal
function openBotModal(botId) {
    currentBotId = botId;
    const modal = document.getElementById('bot-modal');
    modal.style.display = 'flex';
    
    // Update all bot-id attributes
    document.querySelectorAll('[data-bot-id]').forEach(el => {
        el.setAttribute('data-bot-id', botId);
    });
    
    loadBotStatus(botId);
    setInterval(() => loadBotStatus(botId), 2000); // Update every 2 seconds
    
    // If teleop is active, switch to new bot
    const container = document.getElementById('teleop-container');
    if (teleopActive && container && container.style.display !== 'none') {
        startTeleop(botId);
    }
}

function closeBotModal() {
    const modal = document.getElementById('bot-modal');
    modal.style.display = 'none';
    currentBotId = null;
    stopTeleop();
}

function loadBotStatus(botId) {
    fetch(`/bots/${botId}`)
        .then(res => res.json())
        .then(bot => {
            document.getElementById('modal-bot-name').textContent = `Control: ${bot.name}`;
            document.getElementById('modal-bot-status').textContent = bot.status;
            document.getElementById('modal-bot-position').textContent = 
                bot.position ? `${bot.position.x}, ${bot.position.y}, ${bot.position.z}` : 'N/A';
            document.getElementById('modal-bot-health').textContent = bot.health ? `${bot.health}/20` : 'N/A';
            document.getElementById('modal-bot-food').textContent = bot.food ? `${bot.food}/20` : 'N/A';
        })
        .catch(err => console.error('Error loading bot status:', err));
}

// Movement controls
document.querySelectorAll('.control-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
        const botId = this.getAttribute('data-bot-id');
        const action = this.getAttribute('data-action');
        
        if (!botId) return;
        
        try {
            const response = await fetch(`/bots/${botId}/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, duration: 1000 })
            });
            
            if (response.ok) {
                sendWebSocketMessage('bot_control', { botId, action: 'move', command: action });
            }
        } catch (error) {
            console.error('Error controlling bot:', error);
        }
    });
});

// Quick actions
document.getElementById('btn-attack').addEventListener('click', async function() {
    const botId = this.getAttribute('data-bot-id');
    if (!botId) return;
    
    try {
        await fetch(`/bots/${botId}/attack`, { method: 'POST' });
        sendWebSocketMessage('bot_control', { botId, action: 'attack' });
    } catch (error) {
        console.error('Error:', error);
    }
});

document.getElementById('btn-inventory').addEventListener('click', async function() {
    const botId = this.getAttribute('data-bot-id');
    if (!botId) return;
    
    try {
        const response = await fetch(`/bots/${botId}/inventory`);
        const data = await response.json();
        showInventory(data);
    } catch (error) {
        console.error('Error:', error);
    }
});

document.getElementById('btn-use').addEventListener('click', async function() {
    const botId = this.getAttribute('data-bot-id');
    if (!botId) return;
    
    try {
        await fetch(`/bots/${botId}/use`, { method: 'POST' });
        sendWebSocketMessage('bot_control', { botId, action: 'use' });
    } catch (error) {
        console.error('Error:', error);
    }
});

// Chat
document.getElementById('btn-chat-send').addEventListener('click', async function() {
    const botId = this.getAttribute('data-bot-id');
    const message = document.getElementById('chat-input').value;
    
    if (!botId || !message) return;
    
    try {
        await fetch(`/bots/${botId}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        document.getElementById('chat-input').value = '';
        sendWebSocketMessage('bot_control', { botId, action: 'chat', message });
    } catch (error) {
        console.error('Error:', error);
    }
});

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('btn-chat-send').click();
    }
});

// Block controls
document.getElementById('btn-place').addEventListener('click', async function() {
    const botId = this.getAttribute('data-bot-id');
    const x = parseFloat(document.getElementById('block-x').value);
    const y = parseFloat(document.getElementById('block-y').value);
    const z = parseFloat(document.getElementById('block-z').value);
    const blockName = document.getElementById('block-name').value;
    
    if (!botId || !blockName) {
        alert('Por favor completa todos los campos');
        return;
    }
    
    try {
        await fetch(`/bots/${botId}/place`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x, y, z, blockName })
        });
        sendWebSocketMessage('bot_control', { botId, action: 'place', x, y, z, blockName });
    } catch (error) {
        console.error('Error:', error);
    }
});

document.getElementById('btn-dig').addEventListener('click', async function() {
    const botId = this.getAttribute('data-bot-id');
    const x = parseFloat(document.getElementById('block-x').value);
    const y = parseFloat(document.getElementById('block-y').value);
    const z = parseFloat(document.getElementById('block-z').value);
    
    if (!botId) {
        alert('Por favor completa las coordenadas');
        return;
    }
    
    try {
        await fetch(`/bots/${botId}/dig`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x, y, z })
        });
        sendWebSocketMessage('bot_control', { botId, action: 'dig', x, y, z });
    } catch (error) {
        console.error('Error:', error);
    }
});

// Delete bot
document.getElementById('btn-delete-bot').addEventListener('click', async function() {
    const botId = this.getAttribute('data-bot-id');
    if (!botId) return;
    
    if (!confirm('¿Estás seguro de que quieres eliminar este bot?')) return;
    
    try {
        await fetch(`/bots/${botId}`, { method: 'DELETE' });
        sendWebSocketMessage('bot_deleted', { botId });
        closeBotModal();
        loadBots();
    } catch (error) {
        console.error('Error:', error);
    }
});

let selectedInventorySlot = null;
let inventoryBotId = null;

function showInventory(inventory) {
    const modal = document.getElementById('inventory-modal');
    const content = document.getElementById('inventory-content');
    inventoryBotId = currentBotId;
    selectedInventorySlot = null;
    
    let html = '<div style="margin-bottom: 15px;"><strong>Inventario (Haz clic en un slot para seleccionarlo, luego clic en otro para intercambiar)</strong></div>';
    html += '<div class="inventory-grid">';
    
    inventory.items.forEach((item, index) => {
        const itemName = item.name ? item.name.replace('minecraft:', '') : 'Vacío';
        const isHotbar = index < 9;
        const slotClass = isHotbar ? 'hotbar-slot' : '';
        
        html += `
            <div class="inventory-slot ${item.count > 0 ? 'has-item' : ''} ${slotClass}" 
                 data-slot="${index}" 
                 onclick="selectInventorySlot(${index})"
                 style="${isHotbar ? 'border: 2px solid #ff9800;' : ''}">
                <div class="inventory-slot-name">${itemName}</div>
                <div class="inventory-slot-count">${item.count > 0 ? `x${item.count}` : ''}</div>
                ${isHotbar ? '<div style="font-size: 0.6rem; color: #ff9800;">Hotbar</div>' : ''}
            </div>
        `;
    });
    html += '</div>';
    
    if (inventory.heldItem) {
        html += `<div style="margin-top: 20px; padding: 15px; background: var(--dark-bg); border-radius: 8px;">
            <strong>Item en mano (Hotbar slot ${inventory.heldItem.slot || 'N/A'}):</strong> ${inventory.heldItem.name.replace('minecraft:', '')} x${inventory.heldItem.count}
        </div>`;
    }
    
    html += `<div style="margin-top: 15px; padding: 10px; background: var(--dark-bg); border-radius: 5px;">
        <div id="inventory-selection-info" style="color: var(--text-secondary);">Selecciona un slot para intercambiar items</div>
        <button id="btn-swap-items" class="btn btn-primary" style="margin-top: 10px; display: none;" onclick="swapInventoryItems()">Intercambiar Items</button>
    </div>`;
    
    content.innerHTML = html;
    modal.style.display = 'flex';
}

function selectInventorySlot(slot) {
    if (!inventoryBotId) return;
    
    const slots = document.querySelectorAll('.inventory-slot');
    slots.forEach(s => s.classList.remove('selected'));
    
    if (selectedInventorySlot === slot) {
        // Deseleccionar si se hace clic en el mismo slot
        selectedInventorySlot = null;
        document.getElementById('inventory-selection-info').textContent = 'Selecciona un slot para intercambiar items';
        document.getElementById('btn-swap-items').style.display = 'none';
    } else if (selectedInventorySlot === null) {
        // Seleccionar primer slot
        selectedInventorySlot = slot;
        const slotEl = document.querySelector(`[data-slot="${slot}"]`);
        if (slotEl) {
            slotEl.classList.add('selected');
            document.getElementById('inventory-selection-info').textContent = `Slot ${slot} seleccionado. Haz clic en otro slot para intercambiar.`;
            document.getElementById('btn-swap-items').style.display = 'none';
        }
    } else {
        // Intercambiar con el slot seleccionado
        swapInventorySlots(selectedInventorySlot, slot);
    }
}

function swapInventorySlots(fromSlot, toSlot) {
    if (!inventoryBotId) return;
    
    fetch(`/bots/${inventoryBotId}/inventory/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromSlot, toSlot })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            // Recargar inventario
            fetch(`/bots/${inventoryBotId}/inventory`)
                .then(res => res.json())
                .then(inv => showInventory(inv));
        } else {
            alert('Error: ' + (data.error || 'No se pudo intercambiar'));
        }
    })
    .catch(err => {
        console.error('Error swapping items:', err);
        alert('Error al intercambiar items');
    });
}

function swapInventoryItems() {
    // Esta función se llama desde el botón, pero selectInventorySlot ya maneja el intercambio
    // Se mantiene por compatibilidad
}

function closeInventoryModal() {
    document.getElementById('inventory-modal').style.display = 'none';
}

// Close modals when clicking outside
window.onclick = function(event) {
    const botModal = document.getElementById('bot-modal');
    const invModal = document.getElementById('inventory-modal');
    
    if (event.target === botModal) {
        closeBotModal();
    }
    if (event.target === invModal) {
        closeInventoryModal();
    }
}

// Load servers history
async function loadServersHistory() {
    try {
        const response = await fetch('/servers');
        const data = await response.json();
        updateServersHistoryUI(data.servers);
        updateServerAutocomplete(data.servers);
    } catch (error) {
        console.error('Error loading servers history:', error);
    }
}

function updateServersHistoryUI(servers) {
    const container = document.getElementById('servers-history-list');
    if (!container) return;
    
    if (servers.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No hay servidores en el historial</p>';
        return;
    }
    
    container.innerHTML = servers.map(server => `
        <div class="server-history-item">
            <div class="server-info">
                <div class="server-main">
                    <strong>${server.host}:${server.port}</strong>
                    ${server.version ? `<span class="server-version">v${server.version}</span>` : ''}
                </div>
                <div class="server-meta">
                    <span>Usado ${server.useCount} vez${server.useCount !== 1 ? 'es' : ''}</span>
                    <span>•</span>
                    <span>${new Date(server.lastUsed).toLocaleString()}</span>
                </div>
            </div>
            <div class="server-actions">
                <button class="btn-use-server" data-host="${server.host}" data-port="${server.port}" data-version="${server.version || ''}">Usar</button>
                <button class="btn-delete-server" data-key="${server.key}">🗑️</button>
            </div>
        </div>
    `).join('');
    
    // Add event listeners
    container.querySelectorAll('.btn-use-server').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('server-host').value = btn.getAttribute('data-host');
            document.getElementById('server-port').value = btn.getAttribute('data-port');
            const version = btn.getAttribute('data-version');
            if (version) {
                document.getElementById('version').value = version;
            }
            document.getElementById('server-history-section').style.display = 'none';
        });
    });
    
    container.querySelectorAll('.btn-delete-server').forEach(btn => {
        btn.addEventListener('click', async () => {
            const key = btn.getAttribute('data-key');
            if (confirm('¿Eliminar este servidor del historial?')) {
                try {
                    await fetch(`/servers/${encodeURIComponent(key)}`, { method: 'DELETE' });
                    loadServersHistory();
                } catch (error) {
                    console.error('Error deleting server:', error);
                }
            }
        });
    });
}

function updateServerAutocomplete(servers) {
    const datalist = document.getElementById('server-history-list');
    if (!datalist) return;
    
    datalist.innerHTML = servers.map(server => 
        `<option value="${server.host}:${server.port}">${server.host}:${server.port}${server.version ? ` (${server.version})` : ''}</option>`
    ).join('');
}

// Export CSV
document.getElementById('btn-export-csv')?.addEventListener('click', async () => {
    try {
        const response = await fetch('/servers/export');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `servers-history-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting CSV:', error);
        alert('Error al exportar CSV');
    }
});

// Import CSV
document.getElementById('btn-import-csv')?.addEventListener('click', () => {
    document.getElementById('csv-file-input').click();
});

document.getElementById('csv-file-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const csv = event.target.result;
            const response = await fetch('/servers/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ csv })
            });
            
            const result = await response.json();
            if (result.success) {
                alert(`✅ ${result.message}`);
                loadServersHistory();
            } else {
                alert(`❌ Error: ${result.message}`);
            }
        } catch (error) {
            console.error('Error importing CSV:', error);
            alert('Error al importar CSV');
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
});

// Toggle history section
document.getElementById('btn-show-history')?.addEventListener('click', () => {
    const section = document.getElementById('server-history-section');
    if (section.style.display === 'none') {
        section.style.display = 'block';
        loadServersHistory();
    } else {
        section.style.display = 'none';
    }
});

// Teleoperation 3D View
let teleopScene = null;
let teleopCamera = null;
let teleopRenderer = null;
let teleopActive = false;
let teleopBotId = null;
let teleopWorldData = null;
let teleopBlocks = [];
let teleopEntities = [];
let teleopBotMesh = null;
let teleopControls = {
    forward: false,
    back: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    sneak: false
};
let teleopMouseDown = false;
let teleopLastMouseX = 0;
let teleopLastMouseY = 0;
let teleopYaw = 0;
let teleopPitch = 0;
let teleopWorldUpdateInterval = null;
let teleopControlsEnabled = false; // Nuevo: control de activación de controles
let teleopFullscreen = false;
let teleopGroundPlane = null;

// Block colors mapping
const blockColors = {
    'grass_block': 0x7cbd3f,
    'dirt': 0x8b6f47,
    'stone': 0x808080,
    'cobblestone': 0x6b6b6b,
    'wood': 0x8b4513,
    'oak_log': 0x8b4513,
    'sand': 0xf4e4bc,
    'gravel': 0x888888,
    'water': 0x3f76e4,
    'lava': 0xff4500,
    'default': 0x888888
};

function getBlockColor(blockName) {
    for (const [key, color] of Object.entries(blockColors)) {
        if (blockName.includes(key)) {
            return color;
        }
    }
    return blockColors.default;
}

function initTeleop3D() {
    if (typeof THREE === 'undefined') {
        console.error('Three.js not loaded! Please check the CDN link.');
        alert('Error: Three.js no se cargó correctamente. Por favor recarga la página.');
        return;
    }
    
    const container = document.getElementById('teleop-canvas-container');
    const canvas = document.getElementById('teleop-canvas');
    
    if (!container || !canvas) {
        console.error('Teleop container or canvas not found');
        return;
    }

    // Scene - Estilo Minecraft simplificado
    teleopScene = new THREE.Scene();
    teleopScene.background = new THREE.Color(0x87CEEB); // Sky blue
    
    // Camera
    const width = container.clientWidth;
    const height = container.clientHeight;
    teleopCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 200);
    
    // Renderer - Sin antialiasing para estilo más pixelado
    teleopRenderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false });
    teleopRenderer.setSize(width, height);
    teleopRenderer.shadowMap.enabled = false; // Desactivar sombras para mejor rendimiento
    
    // Lighting simple
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    teleopScene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(50, 100, 50);
    teleopScene.add(directionalLight);
    
    // Crear piso simple (estilo Minecraft)
    const groundSize = 50;
    const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x7cbd3f }); // Color hierba
    teleopGroundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    teleopGroundPlane.rotation.x = -Math.PI / 2;
    teleopGroundPlane.position.y = 0;
    teleopScene.add(teleopGroundPlane);
    
    // Handle window resize
    window.addEventListener('resize', () => {
        if (teleopCamera && teleopRenderer && container) {
            const width = container.clientWidth;
            const height = container.clientHeight;
            teleopCamera.aspect = width / height;
            teleopCamera.updateProjectionMatrix();
            teleopRenderer.setSize(width, height);
        }
    });
    
    // Mouse controls
    canvas.addEventListener('mousedown', (e) => {
        teleopMouseDown = true;
        teleopLastMouseX = e.clientX;
        teleopLastMouseY = e.clientY;
        canvas.requestPointerLock();
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (teleopMouseDown && document.pointerLockElement === canvas) {
            const deltaX = e.movementX || 0;
            const deltaY = e.movementY || 0;
            
            teleopYaw -= deltaX * 0.002;
            teleopPitch -= deltaY * 0.002;
            teleopPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, teleopPitch));
            
            // Send look command
            if (teleopBotId && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'bot_control',
                    botId: teleopBotId,
                    action: 'look',
                    yaw: teleopYaw,
                    pitch: teleopPitch
                }));
            }
        }
    });
    
    canvas.addEventListener('mouseup', () => {
        teleopMouseDown = false;
        document.exitPointerLock();
    });
    
    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement !== canvas) {
            teleopMouseDown = false;
        }
    });
    
    // Keyboard controls - Solo si están habilitados
    const keyMap = {
        'w': 'forward',
        's': 'back',
        'a': 'left',
        'd': 'right',
        ' ': 'jump',
        'Shift': 'sprint',
        'Control': 'sneak',
        'e': 'inventory'
    };
    
    window.addEventListener('keydown', (e) => {
        if (!teleopActive || !teleopControlsEnabled) return;
        
        // Inventario con E
        if (e.key.toLowerCase() === 'e') {
            e.preventDefault();
            openTeleopInventory();
            return;
        }
        
        const key = e.key.toLowerCase();
        const action = keyMap[key] || keyMap[e.key];
        
        if (action && action !== 'inventory' && !teleopControls[action]) {
            teleopControls[action] = true;
            sendTeleopControl(action, true);
        }
    });
    
    window.addEventListener('keyup', (e) => {
        if (!teleopActive || !teleopControlsEnabled) return;
        
        const key = e.key.toLowerCase();
        const action = keyMap[key] || keyMap[e.key];
        
        if (action && action !== 'inventory' && teleopControls[action]) {
            teleopControls[action] = false;
            sendTeleopControl(action, false);
        }
    });
    
    // Prevent space from scrolling
    window.addEventListener('keydown', (e) => {
        if (teleopActive && teleopControlsEnabled && e.key === ' ') {
            e.preventDefault();
        }
    });
    
    // Mouse controls - Solo si están habilitados
    canvas.addEventListener('mousedown', (e) => {
        if (!teleopControlsEnabled) return;
        teleopMouseDown = true;
        canvas.requestPointerLock();
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (!teleopControlsEnabled || !teleopMouseDown || document.pointerLockElement !== canvas) return;
        
        const deltaX = e.movementX || 0;
        const deltaY = e.movementY || 0;
        
        teleopYaw -= deltaX * 0.002;
        teleopPitch -= deltaY * 0.002;
        teleopPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, teleopPitch));
        
        // Send look command
        if (teleopBotId && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'bot_control',
                botId: teleopBotId,
                action: 'look',
                yaw: teleopYaw,
                pitch: teleopPitch
            }));
        }
    });
    
    canvas.addEventListener('mouseup', () => {
        teleopMouseDown = false;
        if (document.pointerLockElement === canvas) {
            document.exitPointerLock();
        }
    });
    
    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement !== canvas) {
            teleopMouseDown = false;
        }
    });
}

function sendTeleopControl(action, pressed) {
    if (!teleopBotId || !ws || ws.readyState !== WebSocket.OPEN) return;
    
    if (pressed) {
        ws.send(JSON.stringify({
            type: 'bot_control',
            botId: teleopBotId,
            action: 'move',
            command: action,
            duration: 100
        }));
    } else {
        // Stop movement by sending opposite or clearing
        ws.send(JSON.stringify({
            type: 'bot_control',
            botId: teleopBotId,
            action: 'move',
            command: action,
            duration: 0
        }));
    }
}

function updateTeleopWorld(worldData) {
    if (!teleopScene || !worldData) {
        console.warn('Cannot update teleop world: scene or data missing');
        return;
    }
    
    try {
        teleopWorldData = worldData;
        
        // Clear existing blocks (except ground)
        teleopBlocks.forEach(block => {
            teleopScene.remove(block);
        });
        teleopBlocks = [];
    
        // Add blocks - Solo bloques importantes (simplificado)
        // Filtrar solo bloques cerca del suelo o importantes
        const botY = worldData.bot ? parseFloat(worldData.bot.position.y) : 0;
        const visibleRange = 8; // Solo mostrar bloques en un rango pequeño
        
        worldData.blocks.forEach(blockData => {
            const blockY = parseFloat(blockData.y);
            const distance = Math.abs(blockY - botY);
            
            // Solo mostrar bloques cerca del nivel del bot o del suelo
            if (distance <= visibleRange || blockY <= botY + 2) {
                const geometry = new THREE.BoxGeometry(1, 1, 1);
                const color = getBlockColor(blockData.name);
                const material = new THREE.MeshLambertMaterial({ color: color });
                const cube = new THREE.Mesh(geometry, material);
                cube.position.set(blockData.x, blockData.y, blockData.z);
                teleopScene.add(cube);
                teleopBlocks.push(cube);
            }
        });
    
    // Update bot position
    if (worldData.bot) {
        const botPos = worldData.bot.position;
        
        // Remove old bot mesh
        if (teleopBotMesh) {
            teleopScene.remove(teleopBotMesh);
        }
        
        // Create bot representation
        const botGeometry = new THREE.BoxGeometry(0.6, 1.8, 0.6);
        const botMaterial = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
        teleopBotMesh = new THREE.Mesh(botGeometry, botMaterial);
        teleopBotMesh.position.set(parseFloat(botPos.x), parseFloat(botPos.y) + 0.9, parseFloat(botPos.z));
        teleopScene.add(teleopBotMesh);
        
        // Update camera to follow bot - Vista primera persona (desde los ojos del bot)
        if (teleopCamera) {
            const yaw = parseFloat(worldData.bot.yaw) || teleopYaw;
            const pitch = parseFloat(worldData.bot.pitch) || teleopPitch;
            
            // Cámara en primera persona (desde la posición del bot)
            const eyeHeight = 1.6; // Altura de los ojos en Minecraft
            teleopCamera.position.x = parseFloat(botPos.x);
            teleopCamera.position.y = parseFloat(botPos.y) + eyeHeight;
            teleopCamera.position.z = parseFloat(botPos.z);
            
            // Rotar cámara según yaw y pitch
            teleopCamera.rotation.order = 'YXZ';
            teleopCamera.rotation.y = yaw;
            teleopCamera.rotation.x = pitch;
        }
        
        // Update info overlay
        const infoEl = document.getElementById('teleop-info');
        if (infoEl) {
            infoEl.innerHTML = `
                Pos: ${botPos.x}, ${botPos.y}, ${botPos.z} | 
                Salud: ${worldData.bot.health}/20 | 
                Bloques: ${worldData.blocks.length} | 
                Entidades: ${worldData.entities.length}
            `;
        }
    }
    
    // Update entities
    teleopEntities.forEach(entity => {
        teleopScene.remove(entity);
    });
    teleopEntities = [];
    
    worldData.entities.forEach(entityData => {
        const geometry = new THREE.SphereGeometry(0.5, 8, 8);
        const material = new THREE.MeshLambertMaterial({ color: 0xff0000 });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.set(
            parseFloat(entityData.position.x),
            parseFloat(entityData.position.y),
            parseFloat(entityData.position.z)
        );
        teleopScene.add(sphere);
        teleopEntities.push(sphere);
    });
    } catch (err) {
        console.error('Error updating teleop world:', err);
    }
}

function animateTeleop() {
    if (!teleopActive || !teleopRenderer || !teleopScene || !teleopCamera) return;
    
    requestAnimationFrame(animateTeleop);
    teleopRenderer.render(teleopScene, teleopCamera);
}

function startTeleop(botId) {
    if (teleopActive) {
        stopTeleop();
    }
    
    if (!botId) {
        console.error('Cannot start teleop: no bot ID provided');
        return;
    }
    
    teleopActive = true;
    teleopBotId = botId;
    teleopControlsEnabled = false; // Controles desactivados por defecto
    
    // Initialize 3D scene if not already done
    if (!teleopScene) {
        try {
            initTeleop3D();
        } catch (err) {
            console.error('Error initializing 3D scene:', err);
            alert('Error al inicializar la vista 3D: ' + err.message);
            stopTeleop();
            return;
        }
    }
    
    // Request world data
    function requestWorldData() {
        if (ws && ws.readyState === WebSocket.OPEN && teleopBotId) {
            ws.send(JSON.stringify({
                type: 'request_world_data',
                botId: teleopBotId
            }));
        }
    }
    
    // Request initial data
    requestWorldData();
    
    // Set up periodic updates
    teleopWorldUpdateInterval = setInterval(requestWorldData, 500); // Update every 500ms
    
    // Start animation loop
    animateTeleop();
    
    // Update UI
    document.getElementById('teleop-status').textContent = 'Activo';
    document.getElementById('teleop-status').style.color = 'var(--success-color)';
    document.getElementById('btn-fullscreen').style.display = 'inline-block';
    document.getElementById('btn-toggle-controls').style.display = 'inline-block';
    updateControlsStatus();
}

function toggleTeleopControls() {
    teleopControlsEnabled = !teleopControlsEnabled;
    updateControlsStatus();
    
    // Si se desactivan, detener todos los movimientos
    if (!teleopControlsEnabled) {
        Object.keys(teleopControls).forEach(key => {
            if (teleopControls[key]) {
                sendTeleopControl(key, false);
                teleopControls[key] = false;
            }
        });
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }
}

function updateControlsStatus() {
    const btn = document.getElementById('btn-toggle-controls');
    const statusEl = document.getElementById('teleop-controls-status');
    
    if (btn && statusEl) {
        if (teleopControlsEnabled) {
            btn.textContent = '🎮 Controles: ACTIVADOS';
            btn.className = 'btn btn-success';
            statusEl.textContent = '✅ Controles ACTIVADOS - Puedes usar WASD, Mouse, Espacio, etc.';
            statusEl.style.color = '#4CAF50';
        } else {
            btn.textContent = '🎮 Controles: DESACTIVADOS';
            btn.className = 'btn btn-warning';
            statusEl.textContent = '⚠️ Controles DESACTIVADOS - Presiona el botón para activar';
            statusEl.style.color = '#ff6b6b';
        }
    }
}

function toggleFullscreen() {
    const container = document.getElementById('teleop-canvas-container');
    if (!container) return;
    
    if (!teleopFullscreen) {
        // Entrar a pantalla completa
        if (container.requestFullscreen) {
            container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
            container.webkitRequestFullscreen();
        } else if (container.msRequestFullscreen) {
            container.msRequestFullscreen();
        }
        teleopFullscreen = true;
        document.getElementById('btn-fullscreen').textContent = '⛶ Salir de Pantalla Completa';
        
        // Ajustar tamaño del renderer
        setTimeout(() => {
            if (teleopRenderer && teleopCamera) {
                teleopRenderer.setSize(window.innerWidth, window.innerHeight);
                teleopCamera.aspect = window.innerWidth / window.innerHeight;
                teleopCamera.updateProjectionMatrix();
            }
        }, 100);
    } else {
        // Salir de pantalla completa
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
        teleopFullscreen = false;
        document.getElementById('btn-fullscreen').textContent = '⛶ Pantalla Completa';
        
        // Restaurar tamaño
        setTimeout(() => {
            const container = document.getElementById('teleop-canvas-container');
            if (teleopRenderer && teleopCamera && container) {
                teleopRenderer.setSize(container.clientWidth, container.clientHeight);
                teleopCamera.aspect = container.clientWidth / container.clientHeight;
                teleopCamera.updateProjectionMatrix();
            }
        }, 100);
    }
}

function openTeleopInventory() {
    if (!teleopBotId) return;
    
    fetch(`/bots/${teleopBotId}/inventory`)
        .then(res => res.json())
        .then(data => {
            showInventory(data);
        })
        .catch(err => {
            console.error('Error loading inventory:', err);
            alert('Error al cargar el inventario');
        });
}

function stopTeleop() {
    teleopActive = false;
    teleopBotId = null;
    teleopControlsEnabled = false;
    
    if (teleopWorldUpdateInterval) {
        clearInterval(teleopWorldUpdateInterval);
        teleopWorldUpdateInterval = null;
    }
    
    // Stop all controls
    Object.keys(teleopControls).forEach(key => {
        if (teleopControls[key]) {
            sendTeleopControl(key, false);
            teleopControls[key] = false;
        }
    });
    
    // Salir de pantalla completa si está activa
    if (teleopFullscreen) {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
        teleopFullscreen = false;
    }
    
    // Salir de pointer lock
    if (document.pointerLockElement) {
        document.exitPointerLock();
    }
    
    // Update UI
    document.getElementById('teleop-status').textContent = 'Inactivo';
    document.getElementById('teleop-status').style.color = 'var(--text-secondary)';
    document.getElementById('btn-fullscreen').style.display = 'none';
    document.getElementById('btn-toggle-controls').style.display = 'none';
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    initWebSocket();
    loadBots();
    loadServersHistory();
    
    // Toggle teleoperation
    const toggleBtn = document.getElementById('btn-toggle-teleop');
    const container = document.getElementById('teleop-container');
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            if (container.style.display === 'none') {
                container.style.display = 'block';
                toggleBtn.textContent = '🖥️ Desactivar Vista 3D';
                
                if (currentBotId) {
                    startTeleop(currentBotId);
                }
            } else {
                container.style.display = 'none';
                toggleBtn.textContent = '🖥️ Activar Vista 3D';
                stopTeleop();
            }
        });
    }
    
    // Fullscreen button
    const fullscreenBtn = document.getElementById('btn-fullscreen');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }
    
    // Toggle controls button
    const controlsBtn = document.getElementById('btn-toggle-controls');
    if (controlsBtn) {
        controlsBtn.addEventListener('click', toggleTeleopControls);
    }
    
    // Handle fullscreen change events
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            teleopFullscreen = false;
            if (fullscreenBtn) {
                fullscreenBtn.textContent = '⛶ Pantalla Completa';
            }
        }
    });
    
    document.addEventListener('webkitfullscreenchange', () => {
        if (!document.webkitFullscreenElement) {
            teleopFullscreen = false;
            if (fullscreenBtn) {
                fullscreenBtn.textContent = '⛶ Pantalla Completa';
            }
        }
    });
});

