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
  const queryToken = req.query.token as string | undefined;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (queryToken) {
    token = queryToken;
  }

  if (!token) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { connectionId: string; username: string };
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn('JWT verification failed', { token: token.substring(0, 10) + '...' });
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
