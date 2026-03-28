// src/services/WebSocketService.ts
export interface WebSocketMessage {
  agent: string;
  level: string;
  message: string;
  message_type: string;
  is_truncated?: boolean;
  timestamp?: string;
  log_id?: string;
  type?: string;
}

class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private url: string | null = null;
  private listeners: Array<(data: WebSocketMessage) => void> = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimeout: ReturnType<typeof setTimeout>| null = null;
  private isReconnecting = false;
  private callbacks: Map<string, (data: any) => void> = new Map();
  private messageHistory: WebSocketMessage[] = []; // 存储当前任务的历史记录


  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  public connect(taskId: string, onConnect?: () => void, onError?: (error: string) => void): void {
    if (this.ws && this.url === `ws://127.0.0.1:8000/ws/${taskId}`) {
      // 如果已经连接到相同的taskId，则直接返回
      return;
    }

    // 清理之前的连接
    if (this.ws) {
      this.disconnect();
    }

    this.clearHistory(); // 切换任务时清空历史记录
    this.url = `ws://127.0.0.1:8000/ws/${taskId}`;
    this.connectWebSocket(onConnect, onError);
  }

  private connectWebSocket(onConnect?: () => void, onError?: (error: string) => void): void {
    if (this.isReconnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      onError && onError('Max reconnection attempts reached. Please refresh the page.');
      return;
    }

    this.isReconnecting = true;

    try {
      this.ws = new WebSocket(this.url!);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        onConnect && onConnect();
      };

      this.ws.onmessage = (event) => {
        console.log('Received message:', event.data); // 添加调试信息

        try {
          const data = JSON.parse(event.data);
          console.log('Parsed data:', data); // 添加调试信息
 
          // 忽略系统消息
          if (data.type === 'CONNECTED' || data.type === 'PING') {
            return;
          }
          
          // 这是日志消息，必须包含 agent 和 message_type
          if (data.agent && data.message_type && data.level && data.message) {
            const logMsg: WebSocketMessage = {
              agent: data.agent,
              level: data.level,
              message: data.message,
              message_type: data.message_type,
              is_truncated: data.is_truncated || false,
              timestamp: data.timestamp || new Date().toISOString(),
              log_id: data.log_id
            };
            // 将消息添加到历史记录中
            this.messageHistory.push(logMsg);
            // 通知所有监听器
            this.listeners.forEach(callback => callback(logMsg));

          }
        } catch (e) {
          console.error('Parse error:', e);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.isReconnecting = false;
        onError && onError('WebSocket connection error');
      };

      this.ws.onclose = (event) => {
        console.log('❌ WebSocket closed, code:', event.code, 'reason:', event.reason);
        this.isReconnecting = false;
        
        // 指数退避重连，初始延迟 2 秒
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = Math.min(2000 * Math.pow(1.5, this.reconnectAttempts - 1), 30000); // 最大 30 秒
          console.log(`🔄 Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          
          this.reconnectTimeout = setTimeout(() => {
            this.connectWebSocket(onConnect, onError);
          }, delay);
        }
      };
    } catch (error) {
      console.error('Failed to connect:', error);
      onError && onError(`Connection failed: ${error}`);
      this.isReconnecting = false;
    }
  }

  public disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.url = null;
    this.isReconnecting = false;
  }

  public subscribe(callback: (data: WebSocketMessage) => void): void {
    this.listeners.push(callback);
  }

  public unsubscribe(callback: (data: WebSocketMessage) => void): void {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public getHistory(): WebSocketMessage[] {
    return this.messageHistory; // 提供历史记录
  }
  public clearHistory(): void {
    this.messageHistory = []; // 清空历史记录
  }
  public getConnectionState(): WebSocket['readyState'] | null {
    return this.ws ? this.ws.readyState : null;
  }
}

export default WebSocketService.getInstance();