import { EventEmitter } from 'events';

class WebSocketService extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = 3000; // 3 секунди
  }

  connect() {
    if (this.socket) {
      this.socket.close();
    }

    // Використовуємо secure WebSocket (wss) для production та ws для development
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
    
    this.socket = new WebSocket(`${protocol}://${host}/ws/medical_data/`);

    this.socket.onopen = () => {
      console.log('WebSocket з\'єднання встановлено');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
    };

    this.socket.onclose = (event) => {
      console.log('WebSocket з\'єднання закрито', event);
      this.isConnected = false;
      this.emit('disconnected');
      
      // Автоматичне перепідключення
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`Спроба перепідключення ${this.reconnectAttempts} з ${this.maxReconnectAttempts}`);
        setTimeout(() => this.connect(), this.reconnectTimeout);
      } else {
        console.error('Досягнуто максимальну кількість спроб перепідключення');
        this.emit('connection_failed');
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket помилка', error);
      this.emit('error', error);
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Обробка різних типів повідомлень
        if (data.type === 'medical_data') {
          this.emit('medical_data', data.data);
        } else if (data.type === 'evacuation_update') {
          this.emit('evacuation_update', data.data);
        } else if (data.type === 'alert') {
          this.emit('alert', data.data);
        }
      } catch (error) {
        console.error('Помилка при обробці повідомлення WebSocket', error);
      }
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Метод для підписки на оновлення конкретного військового
  subscribeSoldier(soldierId) {
    if (this.isConnected && soldierId) {
      this.socket.send(JSON.stringify({
        action: 'subscribe_soldier',
        soldier_id: soldierId
      }));
    }
  }

  // Метод для відписки від оновлень конкретного військового
  unsubscribeSoldier(soldierId) {
    if (this.isConnected && soldierId) {
      this.socket.send(JSON.stringify({
        action: 'unsubscribe_soldier',
        soldier_id: soldierId
      }));
    }
  }
}

// Створюємо та експортуємо єдиний екземпляр сервісу
const websocketService = new WebSocketService();

export default websocketService; 