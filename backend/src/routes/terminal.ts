import { Router } from 'express';
import { getActiveConnections } from './connection.js';
import { terminalService } from '../services/terminalService.js';
import logger from '../utils/logger.js';

const router = Router();

router.post('/session', async (req, res) => {
  try {
    const { connectionId } = req.body;
    if (!connectionId) return res.status(400).json({ error: 'connectionId required' });

    const conns = getActiveConnections() as Map<string, any>;
    const conn = conns.get(connectionId);
    if (!conn) return res.status(400).json({ error: 'Not connected' });
    if (conn.type === 'local') return res.status(400).json({ error: 'Terminal not available for local' });
    if (!conn.credentials) return res.status(400).json({ error: 'Connection credentials not available' });

    const sessionId = await terminalService.createSession(connectionId, conn.credentials);
    logger.info('Terminal session created', { connectionId, sessionId });

    res.json({ success: true, sessionId });
  } catch (err: any) {
    logger.error('Failed to create terminal session', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/session/:sessionId', async (req, res) => {
  try {
    terminalService.closeSession(req.params.sessionId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as terminalRoutes };
