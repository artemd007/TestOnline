const API_URL = 'http://localhost:5000';
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const REQUEST_TIMEOUT = 30000;
let activeController = null;
let reconnectTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    startListening();
});

window.addEventListener('beforeunload', () => {
    stopListening();
});

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
    }
}

async function listenForMessages() {
    // Остановка предыдущих операций перед новым подключением
    stopListening();
    
    try {
        // Создаем новый контроллер для текущего подключения
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
        
        // Планируем следующий запрос без задержки
        reconnectTimer = setTimeout(listenForMessages, 0);
        
    } catch (error) {
        console.error('Ошибка получения:', error);
        
        // Если ошибка не связана с отменой запроса
        if (error.name !== 'AbortError') {
            handleReconnect();
        }
    }
}

function handleReconnect() {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        
        // Экспоненциальная задержка: 500ms, 1000ms, 2000ms, 4000ms, 8000ms
        const delay = Math.min(8000, 500 * Math.pow(2, reconnectAttempts - 1));
        console.log(`Переподключение через ${delay}ms (попытка ${reconnectAttempts})`);
        
        reconnectTimer = setTimeout(() => {
            listenForMessages();
        }, delay);
    } else {
        console.error('Максимальное количество попыток подключения');
        // Показать пользователю сообщение об ошибке
        document.getElementById('connectionStatus').textContent = 'Соединение потеряно';
    }
}

function startListening() {
    console.log('Прослушивание сообщений...');
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
    
    // Обновляем статус соединения
    document.getElementById('connectionStatus').textContent = 'В сети';
}

document.getElementById('messageInput').addEventListener('keypress', e => {
    if (e.key === 'Enter') sendMessage();
});