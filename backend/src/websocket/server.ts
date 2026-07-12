import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  role?: string;
  isAlive?: boolean;
}

let wss: WebSocketServer | null = null;
const clients = new Set<AuthenticatedWebSocket>();

export function initWebSocketServer(server: Server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
    ws.isAlive = true;
    clients.add(ws);

    console.log('[WebSocket] Client connected. Active clients:', clients.size);

    // Heartbeat check
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Authenticate client via token on first message or query param
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'auth' && data.token) {
          const secret = process.env.JWT_SECRET || 'production-secret-assetflow-token-signature-key-2026';
          const decoded = jwt.verify(data.token, secret) as { id: string; role: string };
          ws.userId = decoded.id;
          ws.role = decoded.role;
          
          ws.send(JSON.stringify({ type: 'auth_success', userId: decoded.id, role: decoded.role }));
          console.log(`[WebSocket] Client authenticated. User: ${ws.userId}, Role: ${ws.role}`);
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: 'WebSocket Authentication failed' }));
        console.error('[WebSocket] Message processing error:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log('[WebSocket] Client disconnected. Active clients:', clients.size);
    });

    ws.on('error', (error) => {
      console.error('[WebSocket] Client error:', error);
      clients.delete(ws);
    });
  });

  // Keep-alive ping interval
  const interval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (ws.isAlive === false) {
        clients.delete(ws);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });
}

// Broadcast message to all connected and authenticated clients
export function broadcast(type: string, payload: any) {
  if (!wss) {
    console.warn('[WebSocket] Cannot broadcast: Server not initialized');
    return;
  }

  const message = JSON.stringify({ type, payload });
  let sentCount = 0;
  
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sentCount++;
    }
  });

  if (process.env.NODE_ENV === 'development') {
    console.log(`[WebSocket Broadcast] Event: ${type}, Sent to ${sentCount} clients`);
  }
}

// Send message to a specific user
export function sendToUser(userId: string, type: string, payload: any) {
  const message = JSON.stringify({ type, payload });
  clients.forEach((client) => {
    if (client.userId === userId && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
