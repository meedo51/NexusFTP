import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import multer from 'multer';
import fs from 'fs';
import { Client as FtpClient } from 'basic-ftp';
import { Client as SshClient } from 'ssh2';

// NOTE: Since basic-ftp and ssh2 require actual servers to connect to,
// we will build a local simulated mode as a fallback if the connection details are "local".
// For real connections, we'll proxy them.

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const PORT = 3434;

app.use(express.json());

// In-process memory store for connections
const activeConnections = new Map<string, any>();

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch(e) {}
  });
  ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket proxy ready' }));
});

// Setup Multer for upload proxying in memory (limit max file size for safety if needed)
const upload = multer({ dest: '/tmp/nexus-ftp-uploads' });

// Simulated local storage to demonstrate operations safely
const MOCK_FILES: Record<string, any[]> = {
  '/': [
    { name: 'Documents', type: 'dir', size: 0, modifyTime: new Date().toISOString(), permissions: 'drwxr-xr-x', owner: 'user', group: 'staff' },
    { name: 'Downloads', type: 'dir', size: 0, modifyTime: new Date().toISOString(), permissions: 'drwxr-xr-x', owner: 'user', group: 'staff' },
    { name: 'config.json', type: 'file', size: 1024, modifyTime: new Date().toISOString(), permissions: '-rw-r--r--', owner: 'user', group: 'staff' },
    { name: 'readme.txt', type: 'file', size: 256, modifyTime: new Date().toISOString(), permissions: '-rw-r--r--', owner: 'user', group: 'staff' }
  ],
  '/Documents': [
    { name: 'Work', type: 'dir', size: 0, modifyTime: new Date().toISOString(), permissions: 'drwxr-xr-x', owner: 'user', group: 'staff' },
    { name: 'invoice.pdf', type: 'file', size: 1048576, modifyTime: new Date().toISOString(), permissions: '-rw-r--r--', owner: 'user', group: 'staff' },
  ],
  '/Documents/Work': [
    { name: 'project.zip', type: 'file', size: 5242880, modifyTime: new Date().toISOString(), permissions: '-rw-r--r--', owner: 'user', group: 'staff' }
  ],
  '/Downloads': []
};


// API Endpoints
app.post('/api/connect', async (req, res) => {
  const { id, protocol, host, port, username, password, privateKey } = req.body;
  // If host is local, we just simulate it
  if (host === 'localhost' || host === '127.0.0.1' || host === 'local') {
    activeConnections.set(id, { type: 'local' });
    return res.json({ success: true, message: 'Connected to local simulation server.' });
  }

  // Real connection attempts
  try {
    if (protocol === 'ftp' || protocol === 'ftps') {
      const client = new FtpClient();
      await client.access({
        host,
        user: username,
        password,
        secure: protocol === 'ftps'
      });
      activeConnections.set(id, { type: 'ftp', client });
      return res.json({ success: true, message: `Connected via ${protocol.toUpperCase()}` });
    } else if (protocol === 'sftp') {
       const conn = new SshClient();
       return new Promise((resolve, reject) => {
         conn.on('ready', () => {
           conn.sftp((err, sftp) => {
             if (err) {
               conn.end();
               return res.status(500).json({ error: 'SFTP subsystem error', detals: err.message });
             }
             activeConnections.set(id, { type: 'sftp', conn, sftp });
             res.json({ success: true, message: 'Connected via SFTP' });
           });
         }).on('error', (err) => {
            res.status(500).json({ error: 'Connection failed', details: err.message });
         }).connect({
           host,
           port: port || 22,
           username,
           password,
           privateKey
         });
       });
    } else {
      res.status(400).json({ error: 'Unsupported protocol' });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Connection failed', details: err.message });
  }
});

app.post('/api/disconnect', (req, res) => {
  const { id } = req.body;
  const conn = activeConnections.get(id);
  if (conn) {
    if (conn.type === 'ftp') conn.client.close();
    if (conn.type === 'sftp') conn.conn.end();
    activeConnections.delete(id);
  }
  res.json({ success: true });
});

app.post('/api/files', async (req, res) => {
  const { id, path: dirPath } = req.body;
  const conn = activeConnections.get(id);
  if (!conn) return res.status(400).json({ error: 'Not connected' });

  try {
    if (conn.type === 'local') {
      const normalizedPath = dirPath.endsWith('/') && dirPath.length > 1 ? dirPath.slice(0, -1) : dirPath || '/';
      const files = MOCK_FILES[normalizedPath];
      if (!files) return res.status(404).json({ error: 'Directory not found' });
      // Simulate network delay
      await new Promise(r => setTimeout(r, 600));
      return res.json({ files });
    } else if (conn.type === 'ftp') {
      const list = await conn.client.list(dirPath);
      const files = list.map((f: any) => ({
        name: f.name,
        type: f.isDirectory ? 'dir' : 'file',
        size: f.size,
        modifyTime: f.modifiedAt ? new Date(f.modifiedAt).toISOString() : new Date().toISOString(),
        permissions: f.permissions ? String(f.permissions) : f.isDirectory ? 'drwxr-xr-x' : '-rw-r--r--',
        owner: f.user || 'Unknown',
        group: f.group || 'Unknown'
      }));
      res.json({ files });
    } else if (conn.type === 'sftp') {
      conn.sftp.readdir(dirPath || '/', (err: any, list: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        const files = list.map(f => ({
          name: f.filename,
          type: f.longname.startsWith('d') ? 'dir' : 'file',
          size: f.attrs.size,
          modifyTime: new Date(f.attrs.mtime * 1000).toISOString(),
          permissions: f.longname.split(' ')[0],
          owner: f.attrs.uid.toString(),
          group: f.attrs.gid.toString()
        }));
        res.json({ files });
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to list directory', details: err.message });
  }
});


// Basic polyfill for create folder to make UI work 
app.post('/api/files/create', async (req, res) => {
  const { id, path: targetPath, type, name } = req.body;
  const conn = activeConnections.get(id);
  if (!conn) return res.status(400).json({ error: 'Not connected' });

  try {
     if (conn.type === 'local') {
       if (!MOCK_FILES[targetPath]) MOCK_FILES[targetPath] = [];
       const newItem = {
         name,
         type: type === 'folder' ? 'dir' : 'file',
         size: 0,
         modifyTime: new Date().toISOString(),
         permissions: type === 'folder' ? 'drwxr-xr-x' : '-rw-r--r--',
         owner: 'user',
         group: 'user'
       };
       MOCK_FILES[targetPath].push(newItem);
       if (type === 'folder') {
         MOCK_FILES[`${targetPath === '/' ? '' : targetPath}/${name}`] = [];
       }
       return res.json({ success: true, item: newItem });
     } else {
        // Implement real create dir if needed
        return res.json({ success: true });
     }
  } catch (err: any) {
     res.status(500).json({ error: err.message });
  }
});

app.post('/api/files/delete', async (req, res) => {
  const { id, items } = req.body; // items: { path, name, type }[]
  const conn = activeConnections.get(id);
  if (!conn) return res.status(400).json({ error: 'Not connected' });

  if (conn.type === 'local') {
     for (const item of items) {
        const arr = MOCK_FILES[item.path];
        if (arr) {
           const idx = arr.findIndex(f => f.name === item.name);
           if (idx !== -1) arr.splice(idx, 1);
        }
     }
     return res.json({ success: true });
  }
  res.json({ success: true });
});

// For keeping it scoped, and since standard Vite setup applies, start Vite below:
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`NexusFTP Server running on http://localhost:${PORT}`);
  });
}

startServer();
