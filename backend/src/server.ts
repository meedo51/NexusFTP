import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

import logger from './utils/logger.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import connectionRoutes from './routes/connection.js';
import fileRoutes from './routes/files.js';
import healthRoutes from './routes/health.js';
import { terminalRoutes } from './routes/terminal.js';
import { terminalService } from './services/terminalService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = parseInt(process.env.PORT || '5000');
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3434,http://localhost:3000').split(',');

// Security
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(authMiddleware);

// WebSocket handler — supports general messages AND terminal sessions
wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', 'http://localhost');
  const token = url.searchParams.get('token') || '';

  // Validate token for terminal connections
  let user: any = null;
  if (token) {
    try {
      user = jwt.verify(token, JWT_SECRET);
    } catch {
      ws.close(4001, 'Invalid token');
      return;
    }
  }

  ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket ready' }));

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      switch (msg.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;

        case 'terminal_connect':
          handleTerminalConnect(ws, msg);
          break;

        case 'terminal_input':
          handleTerminalInput(ws, msg);
          break;

        case 'terminal_resize':
          handleTerminalResize(ws, msg);
          break;

        default:
          break;
      }
    } catch (e) {
      logger.warn('Invalid WebSocket message');
    }
  });

  ws.on('error', (err) => {
    logger.error('WebSocket error', { error: err.message });
  });

  ws.on('close', () => {
    // Clean up any terminal session listeners for this socket
    if ((ws as any)._terminalSessionId) {
      const sid = (ws as any)._terminalSessionId;
      terminalService.off('data', (ws as any)._onData);
      terminalService.off('close', (ws as any)._onClose);
      terminalService.off('error', (ws as any)._onError);
    }
  });
});

// Terminal message handlers
function handleTerminalConnect(ws: any, msg: any) {
  const { sessionId } = msg;
  if (!sessionId) {
    ws.send(JSON.stringify({ type: 'terminal_error', error: 'sessionId required' }));
    return;
  }

  const session = terminalService.getSession(sessionId);
  if (!session) {
    ws.send(JSON.stringify({ type: 'terminal_error', error: 'Session not found' }));
    return;
  }

  ws._terminalSessionId = sessionId;

  ws._onData = (payload: { sessionId: string; data: string }) => {
    if (payload.sessionId === sessionId && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'terminal_data', data: payload.data }));
    }
  };

  ws._onClose = (payload: { sessionId: string }) => {
    if (payload.sessionId === sessionId && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'terminal_closed' }));
    }
  };

  ws._onError = (payload: { sessionId: string; error: string }) => {
    if (payload.sessionId === sessionId && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'terminal_error', error: payload.error }));
    }
  };

  terminalService.on('data', ws._onData);
  terminalService.on('close', ws._onClose);
  terminalService.on('error', ws._onError);

  ws.send(JSON.stringify({ type: 'terminal_connected', sessionId }));
}

function handleTerminalInput(ws: any, msg: any) {
  const sid = ws._terminalSessionId;
  if (!sid) return;
  try {
    terminalService.write(sid, msg.data);
  } catch { /* session gone */ }
}

function handleTerminalResize(ws: any, msg: any) {
  const sid = ws._terminalSessionId;
  if (!sid) return;
  try {
    terminalService.resize(sid, msg.cols, msg.rows);
  } catch { /* session gone */ }
}

// Health endpoint (no auth)
app.use('/health', healthRoutes);

// API routes
app.use('/api', connectionRoutes);
app.use('/api', fileRoutes);
app.use('/api/terminal', terminalRoutes);

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(process.cwd(), '..', 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    logger.warn('Frontend dist not found at ' + distPath);
  }
}

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

server.listen(PORT, '0.0.0.0', () => {
  logger.info(`NexusFTP Backend running on port ${PORT}`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    corsOrigins: CORS_ORIGINS,
  });
  console.log(`\n  🚀 NexusFTP Server running on http://localhost:${PORT}\n`);
});

export default server;
