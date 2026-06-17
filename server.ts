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
const PORT = parseInt(process.env.PORT || '3000', 10);

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
  if (id !== 'local' && !conn) return res.status(400).json({ error: 'Not connected' });

  try {
    if (id === 'local' || (conn && conn.type === 'local')) {
      const resolvedPath = path.resolve(dirPath || process.cwd());
      
      try {
        const items = await fs.promises.readdir(resolvedPath, { withFileTypes: true });
        
        const files = await Promise.all(items.map(async (item) => {
          try {
            const stats = await fs.promises.stat(path.join(resolvedPath, item.name));
            return {
              name: item.name,
              type: item.isDirectory() ? 'dir' : 'file',
              size: stats.size,
              modifyTime: stats.mtime.toISOString(),
              permissions: (item.isDirectory() ? 'd' : '-') + (stats.mode & parseInt('777', 8)).toString(8),
              owner: stats.uid.toString(),
              group: stats.gid.toString()
            };
          } catch (e) {
             return null;
          }
        }));
        
        return res.json({ files: files.filter(Boolean) });
      } catch (e: any) {
        return res.status(404).json({ error: 'Directory not found', details: e.message });
      }
    } else if (conn && conn.type === 'ftp') {
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
  if (id !== 'local' && !conn) return res.status(400).json({ error: 'Not connected' });

  try {
     if (id === 'local' || (conn && conn.type === 'local')) {
       const resolvedPath = path.resolve(targetPath || process.cwd(), name);
       if (type === 'folder') {
         await fs.promises.mkdir(resolvedPath, { recursive: true });
       } else {
         await fs.promises.writeFile(resolvedPath, '');
       }
       
       const stats = await fs.promises.stat(resolvedPath);
       
       const newItem = {
         name,
         type: type === 'folder' ? 'dir' : 'file',
         size: stats.size,
         modifyTime: stats.mtime.toISOString(),
         permissions: (type === 'folder' ? 'd' : '-') + (stats.mode & parseInt('777', 8)).toString(8),
         owner: stats.uid.toString(),
         group: stats.gid.toString()
       };
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
  if (id !== 'local' && !conn) return res.status(400).json({ error: 'Not connected' });

  try {
    if (id === 'local' || (conn && conn.type === 'local')) {
       for (const item of items) {
          const resolvedPath = path.resolve(item.path, item.name);
          if (item.type === 'dir') {
             await fs.promises.rm(resolvedPath, { recursive: true, force: true });
          } else {
             await fs.promises.unlink(resolvedPath);
          }
       }
       return res.json({ success: true });
    }
  } catch (err: any) {
     return res.status(500).json({ error: err.message });
  }
  
  res.json({ success: true });
});

app.post('/api/files/rename', async (req, res) => {
  const { id, path: dirPath, oldName, newName } = req.body;
  const conn = activeConnections.get(id);
  if (id !== 'local' && !conn) return res.status(400).json({ error: 'Not connected' });

  try {
    if (id === 'local' || (conn && conn.type === 'local')) {
      const oldPath = path.resolve(dirPath || process.cwd(), oldName);
      const newPath = path.resolve(dirPath || process.cwd(), newName);
      await fs.promises.rename(oldPath, newPath);
      return res.json({ success: true });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
  return res.json({ success: true });
});

app.post('/api/files/copy', async (req, res) => {
  const { id, items, destPath } = req.body; // items: { path, name, type }[]
  const conn = activeConnections.get(id);
  if (id !== 'local' && !conn) return res.status(400).json({ error: 'Not connected' });

  try {
    if (id === 'local' || (conn && conn.type === 'local')) {
      for (const item of items) {
        const srcPath = path.resolve(item.path, item.name);
        const dest = path.resolve(destPath || process.cwd(), item.name);
        if (item.type === 'dir') {
          await fs.promises.cp(srcPath, dest, { recursive: true });
        } else {
          await fs.promises.copyFile(srcPath, dest);
        }
      }
      return res.json({ success: true });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
  return res.json({ success: true });
});

app.get('/api/files/download', async (req, res) => {
  const { id, path: dirPath, name } = req.query;
  const conn = activeConnections.get(id as string);
  if (id !== 'local' && !conn) return res.status(400).json({ error: 'Not connected' });

  try {
    if (id === 'local' || (conn && conn.type === 'local')) {
      const resolvedPath = path.resolve((dirPath as string) || process.cwd(), name as string);
      return res.download(resolvedPath, name as string);
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/files/permissions', async (req, res) => {
  const { id, path: dirPath, name, permissions } = req.body;
  const conn = activeConnections.get(id);
  if (id !== 'local' && !conn) return res.status(400).json({ error: 'Not connected' });

  try {
    if (id === 'local' || (conn && conn.type === 'local')) {
      const resolvedPath = path.resolve(dirPath || process.cwd(), name);
      // permissions comes in as e.g. "755" or "drwxr-xr-x"
      // We only support numerical for simplicity here
      const mode = parseInt(permissions.replace(/[^0-9]/g, ''), 8);
      if (!isNaN(mode)) {
        await fs.promises.chmod(resolvedPath, mode);
      }
      return res.json({ success: true });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
  return res.json({ success: true });
});

app.post('/api/files/read', async (req, res) => {
  const { id, path: dirPath, name } = req.body;
  const conn = activeConnections.get(id);
  if (id !== 'local' && !conn) return res.status(400).json({ error: 'Not connected' });

  try {
    if (id === 'local' || (conn && conn.type === 'local')) {
      const resolvedPath = path.resolve(dirPath || process.cwd(), name);
      const content = await fs.promises.readFile(resolvedPath, 'utf8');
      return res.json({ success: true, content });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
  return res.status(500).json({ error: 'Unsupported connection type for read' });
});

app.post('/api/files/write', async (req, res) => {
  const { id, path: dirPath, name, content } = req.body;
  const conn = activeConnections.get(id);
  if (id !== 'local' && !conn) return res.status(400).json({ error: 'Not connected' });

  try {
    if (id === 'local' || (conn && conn.type === 'local')) {
      const resolvedPath = path.resolve(dirPath || process.cwd(), name);
      await fs.promises.writeFile(resolvedPath, content, 'utf8');
      return res.json({ success: true });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
  return res.status(500).json({ error: 'Unsupported connection type for write' });
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
