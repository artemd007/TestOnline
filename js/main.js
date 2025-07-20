let API_URL = 'http://localhost:5000';
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const REQUEST_TIMEOUT = 30000;
let activeController = null;
let reconnectTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    // Добавляем обработчик для кнопки изменения адреса
    document.getElementById('updateServerBtn').addEventListener('click', updateServerAddress);
    
    // Автоподключение при загрузке
    startListening();
});

window.addEventListener('beforeunload', () => {
    stopListening();
});

// Функция обновления адреса сервера
function updateServerAddress() {
    const serverInput = document.getElementById('serverAddressInput');
    const newAddress = serverInput.value.trim();
    
    if (!newAddress) {
        alert('Пожалуйста, введите адрес сервера');
        return;
    }
    
    // Проверяем наличие протокола
    API_URL = newAddress.startsWith('http://') || newAddress.startsWith('https://') 
        ? newAddress 
        : `http://${newAddress}`;
    
    // Убираем возможные завершающие слэши
    API_URL = API_URL.replace(/\/+$/, '');
    
    console.log(`Адрес сервера изменён на: ${API_URL}`);
    
    // Перезапускаем подключение
    stopListening();
    startListening();
}

function stopListening() {
    if (activeController) {
        activeController.abort();
        activeController = null;
    }
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    if (!message) return;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
        
        await fetch(`${API_URL}/new-messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                text: message,
                sender: "User",
                timestamp: new Date().toISOString()
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        input.value = '';
    } catch (error) {
        console.error('Ошибка отправки:', error);
        document.getElementById('connectionStatus').textContent = 'Ошибка отправки';
    }
}

async function listenForMessages() {
    stopListening();
    
    try {
        activeController = new AbortController();
        const timeoutId = setTimeout(() => {
            if (activeController) activeController.abort();
        }, REQUEST_TIMEOUT);
        
        const response = await fetch(`${API_URL}/get-messages`, {
            signal: activeController.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const message = await response.json();
        displayMessage(message);
        
        reconnectAttempts = 0;
        reconnectTimer = setTimeout(listenForMessages, 0);
        
    } catch (error) {
        if (error.name !== 'AbortError') {
            handleReconnect(error);
        }
    }
}

function handleReconnect(error) {
    console.error('Ошибка подключения:', error);
    
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        
        const delay = Math.min(8000, 500 * Math.pow(2, reconnectAttempts - 1));
        console.log(`Переподключение через ${delay}ms (попытка ${reconnectAttempts})`);
        
        document.getElementById('connectionStatus').textContent = 
            `Переподключение... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`;
        
        reconnectTimer = setTimeout(() => {
            listenForMessages();
        }, delay);
    } else {
        console.error('Максимальное количество попыток подключения');
        document.getElementById('connectionStatus').textContent = 'Соединение потеряно';
    }
}

function startListening() {
    console.log(`Начало прослушивания на ${API_URL}`);
    reconnectAttempts = 0;
    document.getElementById('connectionStatus').textContent = 'Подключение...';
    listenForMessages();
}

function displayMessage(msg) {
    const messagesContainer = document.getElementById('messages');
    const msgElement = document.createElement('div');
    
    const date = new Date(msg.timestamp || Date.now());
    const timeString = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    msgElement.className = 'message';
    msgElement.innerHTML = `
        <span class="time">${timeString}</span>
        <span class="sender">${msg.sender || 'Unknown'}:</span>
        <span class="text">${msg.text}</span>
    `;
    
    messagesContainer.appendChild(msgElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    document.getElementById('connectionStatus').textContent = 'В сети';
}

document.getElementById('messageInput').addEventListener('keypress', e => {
    if (e.key === 'Enter') sendMessage();
});