// WebSocket connection
let ws = null;
let reconnectInterval = null;
let currentBotId = null;

// Initialize WebSocket connection
function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('WebSocket connected');
        updateWSStatus(true);
        clearInterval(reconnectInterval);
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateWSStatus(false);
    };
    
    ws.onclose = () => {
        console.log('WebSocket disconnected');
        updateWSStatus(false);
        // Attempt to reconnect after 3 seconds
        reconnectInterval = setInterval(initWebSocket, 3000);
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
}

function closeBotModal() {
    const modal = document.getElementById('bot-modal');
    modal.style.display = 'none';
    currentBotId = null;
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

function showInventory(inventory) {
    const modal = document.getElementById('inventory-modal');
    const content = document.getElementById('inventory-content');
    
    let html = '<div class="inventory-grid">';
    inventory.items.forEach((item, index) => {
        html += `
            <div class="inventory-slot ${item.count > 0 ? 'has-item' : ''}">
                <div class="inventory-slot-name">${item.name.replace('minecraft:', '')}</div>
                <div class="inventory-slot-count">${item.count > 0 ? `x${item.count}` : 'Vacío'}</div>
            </div>
        `;
    });
    html += '</div>';
    
    if (inventory.heldItem) {
        html += `<div style="margin-top: 20px; padding: 15px; background: var(--dark-bg); border-radius: 8px;">
            <strong>Item en mano:</strong> ${inventory.heldItem.name.replace('minecraft:', '')} x${inventory.heldItem.count}
        </div>`;
    }
    
    content.innerHTML = html;
    modal.style.display = 'flex';
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

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    initWebSocket();
    loadBots();
    loadServersHistory();
});

