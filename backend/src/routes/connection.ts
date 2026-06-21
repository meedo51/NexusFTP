import { Router } from 'express';
import { FtpService } from '../services/ftpService.js';
import { SftpService } from '../services/sftpService.js';
import { generateToken } from '../middleware/auth.js';
import { connectLimiter } from '../middleware/rateLimiter.js';
import logger from '../utils/logger.js';

export interface ConnectionInfo {
  type: 'local' | 'ftp' | 'sftp';
  service: FtpService | SftpService | null;
  credentials?: {
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKey?: string;
  };
}

const router = Router();
const activeConnections = new Map<string, ConnectionInfo>();

export function getActiveConnections(): Map<string, any> {
  return activeConnections as any;
}

router.post('/connect', connectLimiter, async (req, res) => {
  const { id, protocol, host, port, username, password, privateKey } = req.body;

  if (!id || !host || !username) {
    return res.status(400).json({ error: 'Missing required fields: id, host, username' });
  }

  if (host === 'localhost' || host === '127.0.0.1' || host === 'local') {
    activeConnections.set(id, { type: 'local', service: null });
    const token = generateToken(id, username);
    return res.json({ success: true, message: 'Connected to local simulation server.', token });
  }

  try {
    if (protocol === 'ftp' || protocol === 'ftps') {
      const service = new FtpService();
      await service.connect(host, port || 21, username, password || '', protocol === 'ftps');
      activeConnections.set(id, { type: 'ftp', service, credentials: { host, port: port || 21, username, password } });
      const token = generateToken(id, username);
      logger.info('FTP connection established', { id, host, username });
      return res.json({ success: true, message: `Connected via ${protocol.toUpperCase()}`, token });
    } else if (protocol === 'sftp') {
      const service = new SftpService();
      await service.connect(host, port || 22, username, password, privateKey);
      activeConnections.set(id, { type: 'sftp', service, credentials: { host, port: port || 22, username, password, privateKey } });
      const token = generateToken(id, username);
      logger.info('SFTP connection established', { id, host, username });
      return res.json({ success: true, message: 'Connected via SFTP', token });
    } else {
      return res.status(400).json({ error: 'Unsupported protocol' });
    }
  } catch (err: any) {
    logger.error('Connection failed', { id, host, error: err.message });
    return res.status(500).json({ error: 'Connection failed', details: err.message });
  }
});

router.post('/disconnect', (req, res) => {
  const { id } = req.body;
  const conn = activeConnections.get(id);
  if (conn) {
    if (conn.service) {
      if (conn.service instanceof FtpService) conn.service.close();
      if (conn.service instanceof SftpService) conn.service.close();
    }
    activeConnections.delete(id);
    logger.info('Connection closed', { id });
  }
  res.json({ success: true });
});

export default router;
