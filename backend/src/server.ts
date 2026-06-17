import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

import logger from './utils/logger.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import connectionRoutes from './routes/connection.js';
import fileRoutes from './routes/files.js';
import healthRoutes from './routes/health.js';

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

// WebSocket handlers
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket proxy ready' }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
    } catch (e) {
      logger.warn('Invalid WebSocket message');
    }
  });

  ws.on('error', (err) => {
    logger.error('WebSocket error', { error: err.message });
  });
});

// Health endpoint (no auth)
app.use('/health', healthRoutes);

// API routes
app.use('/api', connectionRoutes);
app.use('/api', fileRoutes);

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
