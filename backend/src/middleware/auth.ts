import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export interface AuthRequest extends Request {
  user?: { connectionId: string; username: string };
}

export function generateToken(connectionId: string, username: string): string {
  return jwt.sign({ connectionId, username }, JWT_SECRET, { expiresIn: '24h' });
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const publicRoutes = ['/api/connect', '/health', '/api/health'];
  if (publicRoutes.includes(req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { connectionId: string; username: string };
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn('JWT verification failed', { token: token.substring(0, 10) + '...' });
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
