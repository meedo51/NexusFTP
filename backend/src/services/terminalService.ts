import { Client } from 'ssh2';
import { EventEmitter } from 'events';
import { generateId } from '../utils/helpers.js';
import logger from '../utils/logger.js';

export interface TerminalSession {
  id: string;
  connectionId: string;
  client: Client;
  stream: any;
  createdAt: Date;
  lastActivity: Date;
  history: string[];
  historyIndex: number;
}

export class TerminalService extends EventEmitter {
  private sessions = new Map<string, TerminalSession>();
  private readonly MAX_HISTORY = 1000;

  async createSession(connectionId: string, credentials: { host: string; port: number; username: string; password?: string; privateKey?: string }): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = new Client();
      const sessionId = generateId();

      client.on('ready', () => {
        client.shell({ term: 'xterm-256color' }, (err, stream) => {
          if (err) { reject(err); return; }

          const session: TerminalSession = {
            id: sessionId,
            connectionId,
            client,
            stream,
            createdAt: new Date(),
            lastActivity: new Date(),
            history: [],
            historyIndex: -1,
          };

          this.sessions.set(sessionId, session);

          stream.on('data', (data: Buffer) => {
            this.emit('data', { sessionId, data: data.toString() });
          });

          stream.stderr.on('data', (data: Buffer) => {
            this.emit('data', { sessionId, data: data.toString() });
          });

          stream.on('close', () => {
            this.emit('close', { sessionId });
            this.sessions.delete(sessionId);
            client.end();
          });

          resolve(sessionId);
        });
      });

      client.on('error', (err) => {
        this.emit('error', { sessionId, error: err.message });
        reject(err);
      });

      client.on('end', () => {
        this.sessions.delete(sessionId);
      });

      client.connect({
        host: credentials.host,
        port: credentials.port || 22,
        username: credentials.username,
        password: credentials.password,
        privateKey: credentials.privateKey,
        readyTimeout: 10000,
      });
    });
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.stream && !session.stream.destroyed) {
      session.stream.write(data);
    }
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.stream && !session.stream.destroyed) {
      session.stream.setWindow(rows, cols, 0, 0);
    }
  }

  getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.stream && !session.stream.destroyed) session.stream.end();
      session.client.end();
      this.sessions.delete(sessionId);
    }
  }
}

export const terminalService = new TerminalService();
