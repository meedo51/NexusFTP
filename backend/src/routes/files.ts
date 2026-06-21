import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { getActiveConnections } from './connection.js';
import { FtpService } from '../services/ftpService.js';
import { SftpService } from '../services/sftpService.js';
import { apiLimiter } from '../middleware/rateLimiter.js';
import logger from '../utils/logger.js';

const router = Router();
router.use(apiLimiter);

const DATA_DIR = process.env.DATA_DIR || '/app/data';
const TRASH_DIR = path.join(DATA_DIR, 'trash');
const TRASH_RETENTION_DAYS = parseInt(process.env.TRASH_RETENTION_DAYS || '30');
const UPLOAD_DIR = '/tmp/nexusftp-uploads';

if (!fs.existsSync(TRASH_DIR)) fs.mkdirSync(TRASH_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({ dest: UPLOAD_DIR });

function getConnection(id: string): { type: string; service: any } | undefined {
  const conns = getActiveConnections() as Map<string, { type: string; service: any }>;
  return conns.get(id);
}

function isLocal(id: string, conn: any): boolean {
  return id === 'local' || (conn && conn.type === 'local');
}

async function handleLocalOperation<T>(fn: () => T): Promise<T> {
  return fn();
}

// List directory
router.post('/files', async (req, res) => {
  const { id, path: dirPath } = req.body;
  const conn = getConnection(id);
  if (id !== 'local' && !conn) return res.status(400).json({ error: 'Not connected' });

  try {
    if (isLocal(id, conn)) {
      const resolvedPath = path.resolve(dirPath || process.cwd());
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
            group: stats.gid.toString(),
          };
        } catch (e) { return null; }
      }));
      return res.json({ files: files.filter(Boolean) });
    } else if (conn.type === 'ftp') {
      const service = conn.service as FtpService;
      const files = await service.list(dirPath);
      return res.json({ files });
    } else if (conn.type === 'sftp') {
      const service = conn.service as SftpService;
      const files = await service.list(dirPath);
      return res.json({ files });
    }
    return res.status(400).json({ error: 'Unsupported connection type' });
  } catch (err: any) {
    logger.error('Failed to list directory', { error: err.message });
    return res.status(500).json({ error: 'Failed to list directory', details: err.message });
  }
});

// Create file/folder
router.post('/files/create', async (req, res) => {
  const { id, path: targetPath, type, name } = req.body;
  const conn = getConnection(id);
  if (id !== 'local' && !conn) return res.status(400).json({ error: 'Not connected' });

  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!type || !['folder', 'file'].includes(type)) return res.status(400).json({ error: 'Type must be folder or file' });

  try {
    if (isLocal(id, conn)) {
      const resolvedPath = path.resolve(targetPath || process.cwd(), name);
      if (type === 'folder') await fs.promises.mkdir(resolvedPath, { recursive: true });
      else await fs.promises.writeFile(resolvedPath, '');
      const stats = await fs.promises.stat(resolvedPath);
      return res.json({
        success: true,
        item: {
          name, type: type === 'folder' ? 'dir' : 'file',
          size: stats.size, modifyTime: stats.mtime.toISOString(),
          permissions: (type === 'folder' ? 'd' : '-') + (stats.mode & parseInt('777', 8)).toString(8),
          owner: stats.uid.toString(), group: stats.gid.toString(),
        },
      });
    } else if (conn.type === 'ftp') {
      const service = conn.service as FtpService;
      if (type === 'folder') await service.mkdir(path.posix.join(targetPath || '/', name));
      else await service.writeFile(path.posix.join(targetPath || '/', name), '');
      return res.json({ success: true });
    } else if (conn.type === 'sftp') {
      const service = conn.service as SftpService;
      const remotePath = path.posix.join(targetPath || '/', name);
      if (type === 'folder') await service.mkdir(remotePath);
      else await service.writeFile(remotePath, '');
      return res.json({ success: true });
    }
  } catch (err: any) {
    logger.error('Failed to create', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// Delete files/folders
router.post('/files/delete', async (req, res) => {
  const { id, items } = req.body;
  const conn = getConnection(id);
  if (id !== 'local' && !conn) return res.status(400).json({ error: 'Not connected' });

  try {
    if (isLocal(id, conn)) {
      for (const item of items) {
        const resolvedPath = path.resolve(item.path, item.name);
        // Move to trash instead of permanent delete
        const trashPath = path.join(TRASH_DIR, `${Date.now()}_${item.name}`);
        if (item.type === 'dir') {
          await fs.promises.cp(resolvedPath, trashPath, { recursive: true });
          await fs.promises.rm(resolvedPath, { recursive: true, force: true });
        } else {
          await fs.promises.copyFile(resolvedPath, trashPath);
          await fs.promises.unlink(resolvedPath);
        }
      }
      return res.json({ success: true });
    } else if (conn.type === 'ftp') {
      const service = conn.service as FtpService;
      for (const item of items) {
        await service.delete(path.posix.join(item.path, item.name), item.type);
      }
      return res.json({ success: true });
    } else if (conn.type === 'sftp') {
      const service = conn.service as SftpService;
      for (const item of items) {
        await service.delete(path.posix.join(item.path, item.name));
      }
      return res.json({ success: true });
    }
  } catch (err: any) {
    logger.error('Failed to delete', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// Rename
router.post('/files/rename', async (req, res) => {
  const { id, path: dirPath, oldName, newName } = req.body;
  const conn = getConnection(id);
  if (id !== 'local' && !conn) return res.status(400).json({ error: 'Not connected' });

  try {
    if (isLocal(id, conn)) {
      const oldPath = path.resolve(dirPath || process.cwd(), oldName);
      const newPath = path.resolve(dirPath || process.cwd(), newName);
      await fs.promises.rename(oldPath, newPath);
      return res.json({ success: true });
    } else if (conn.type === 'ftp') {
      const service = conn.service as FtpService;
      await service.rename(path.posix.join(dirPath || '/', oldName), path.posix.join(dirPath || '/', newName));
      return res.json({ success: true });
    } else if (conn.type === 'sftp') {
      const service = conn.service as SftpService;
      await service.rename(path.posix.join(dirPath || '/', oldName), path.posix.join(dirPath || '/', newName));
      return res.json({ success: true });
    }
  } catch (err: any) {
    logger.error('Failed to rename', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// Copy
router.post('/files/copy', async (req, res) => {
  const { id, items, destPath } = req.body;
  const conn = getConnection(id);
  if (id !== 'local' && !conn) return res.status(400).json({ error: 'Not connected' });

  try {
    if (isLocal(id, conn)) {
      for (const item of items) {
        const srcPath = path.resolve(item.path, item.name);
        const dest = path.resolve(destPath || process.cwd(), item.name);
        if (item.type === 'dir') await fs.promises.cp(srcPath, dest, { recursive: true });
        else await fs.promises.copyFile(srcPath, dest);
      }
      return res.json({ success: true });
    }
    return res.status(400).json({ error: 'Copy only supported for local filesystem' });
  } catch (err: any) {
    logger.error('Failed to copy', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.pdf': 'application/pdf',
  '.zip': 'application/zip', '.gz': 'application/gzip', '.tar': 'application/x-tar',
  '.txt': 'text/plain', '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.xml': 'application/xml', '.csv': 'text/csv',
  '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

// Download file
router.get('/files/download', async (req, res) => {
  const { id, path: dirPath, name } = req.query;
  const conn = getConnection(id as string);
  if (id !== 'local' && !conn) return res.status(400).json({ error: 'Not connected' });

  try {
    const fileName = name as string;
    if (isLocal(id as string, conn)) {
      const resolvedPath = path.resolve((dirPath as string) || process.cwd(), fileName);
      if (!fs.existsSync(resolvedPath)) return res.status(404).json({ error: 'File not found' });
      return res.download(resolvedPath, fileName);
    }

    const ext = path.extname(fileName).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    let buffer: Buffer;
    if (conn.type === 'ftp') {
      const service = conn.service as FtpService;
      buffer = await service.readFile(path.posix.join((dirPath as string) || '/', fileName));
    } else if (conn.type === 'sftp') {
      const service = conn.service as SftpService;
      buffer = await service.readFile(path.posix.join((dirPath as string) || '/', fileName));
    } else {
      return res.status(400).json({ error: 'Unsupported connection type' });
    }
    return res.send(buffer);
  } catch (err: any) {
    logger.error('Failed to download', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// Upload file
router.post('/files/upload', upload.single('file'), async (req, res) => {
  const { id, path: destPath } = req.body;
  const conn = getConnection(id);
  if (id !== 'local' && !conn) return res.status(400).json({ error: 'Not connected' });
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  try {
    if (isLocal(id, conn)) {
      const dest = path.resolve(destPath || process.cwd(), req.file.originalname);
      await fs.promises.copyFile(req.file.path, dest);
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.json({ success: true, name: req.file.originalname, size: req.file.size });
    } else if (conn.type === 'ftp') {
      const service = conn.service as FtpService;
      const remotePath = path.posix.join(destPath || '/', req.file.originalname);
      await service.writeFile(remotePath, await fs.promises.readFile(req.file.path));
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.json({ success: true, name: req.file.originalname });
    } else if (conn.type === 'sftp') {
      const service = conn.service as SftpService;
      const remotePath = path.posix.join(destPath || '/', req.file.originalname);
      await service.writeFile(remotePath, await fs.promises.readFile(req.file.path));
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.json({ success: true, name: req.file.originalname });
    }
  } catch (err: any) {
    logger.error('Failed to upload', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// Read file content
router.post('/files/read', async (req, res) => {
  const { id, path: dirPath, name } = req.body;
  const conn = getConnection(id);
  if (id !== 'local' && !conn) return res.status(400).json({ error: 'Not connected' });

  try {
    if (isLocal(id, conn)) {
      const resolvedPath = path.resolve(dirPath || process.cwd(), name);
      const content = await fs.promises.readFile(resolvedPath, 'utf8');
      return res.json({ success: true, content });
    } else if (conn.type === 'ftp') {
      const service = conn.service as FtpService;
      const buf = await service.readFile(path.posix.join(dirPath || '/', name));
      return res.json({ success: true, content: buf.toString('utf8') });
    } else if (conn.type === 'sftp') {
      const service = conn.service as SftpService;
      const buf = await service.readFile(path.posix.join(dirPath || '/', name));
      return res.json({ success: true, content: buf.toString('utf8') });
    }
  } catch (err: any) {
    logger.error('Failed to read file', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// Write file content
router.post('/files/write', async (req, res) => {
  const { id, path: dirPath, name, content } = req.body;
  const conn = getConnection(id);
  if (id !== 'local' && !conn) return res.status(400).json({ error: 'Not connected' });

  try {
    if (isLocal(id, conn)) {
      const resolvedPath = path.resolve(dirPath || process.cwd(), name);
      await fs.promises.writeFile(resolvedPath, content, 'utf8');
      return res.json({ success: true });
    } else if (conn.type === 'ftp') {
      const service = conn.service as FtpService;
      await service.writeFile(path.posix.join(dirPath || '/', name), content);
      return res.json({ success: true });
    } else if (conn.type === 'sftp') {
      const service = conn.service as SftpService;
      await service.writeFile(path.posix.join(dirPath || '/', name), content);
      return res.json({ success: true });
    }
  } catch (err: any) {
    logger.error('Failed to write file', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// Update permissions
router.post('/files/permissions', async (req, res) => {
  const { id, path: dirPath, name, permissions } = req.body;
  const conn = getConnection(id);
  if (id !== 'local' && !conn) return res.status(400).json({ error: 'Not connected' });

  try {
    if (isLocal(id, conn)) {
      const resolvedPath = path.resolve(dirPath || process.cwd(), name);
      const mode = parseInt(permissions.replace(/[^0-9]/g, ''), 8);
      if (!isNaN(mode)) await fs.promises.chmod(resolvedPath, mode);
      return res.json({ success: true });
    }
    return res.json({ success: true });
  } catch (err: any) {
    logger.error('Failed to set permissions', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// Search files (local only)
router.post('/files/search', async (req, res) => {
  const { id, path: searchPath, query } = req.body;
  const conn = getConnection(id);
  if (id !== 'local' && !conn) return res.status(400).json({ error: 'Not connected' });
  if (!query) return res.status(400).json({ error: 'Search query is required' });

  try {
    if (isLocal(id, conn)) {
      const results: any[] = [];
      const rootPath = path.resolve(searchPath || process.cwd());
      async function walk(dir: string) {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.name.toLowerCase().includes(query.toLowerCase())) {
            try {
              const stats = await fs.promises.stat(fullPath);
              results.push({
                name: entry.name, type: entry.isDirectory() ? 'dir' : 'file',
                path: dir, size: stats.size, modifyTime: stats.mtime.toISOString(),
              });
            } catch (e) { /* skip unreadable */ }
          }
          if (entry.isDirectory()) {
            await walk(fullPath);
          }
          if (results.length >= 100) break;
        }
      }
      await walk(rootPath);
      return res.json({ files: results.slice(0, 100) });
    }
    return res.status(400).json({ error: 'Search only supported on local' });
  } catch (err: any) {
    logger.error('Search failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// Trash management
router.get('/trash/list', (req, res) => {
  try {
    const items = fs.readdirSync(TRASH_DIR).map(name => {
      const stat = fs.statSync(path.join(TRASH_DIR, name));
      return { name, size: stat.size, deletedAt: stat.mtime.toISOString() };
    });
    res.json({ files: items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/trash/restore', async (req, res) => {
  const { name, originalPath } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const src = path.join(TRASH_DIR, name);
    const dest = originalPath ? path.resolve(originalPath, name.replace(/^\d+_/, '')) : path.resolve(process.cwd(), name.replace(/^\d+_/, ''));
    await fs.promises.copyFile(src, dest);
    await fs.promises.unlink(src);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/trash/empty', async (req, res) => {
  try {
    const items = fs.readdirSync(TRASH_DIR);
    for (const item of items) {
      const fullPath = path.join(TRASH_DIR, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) fs.rmSync(fullPath, { recursive: true });
      else fs.unlinkSync(fullPath);
    }
    res.json({ success: true, emptied: items.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Periodic trash cleanup
setInterval(() => {
  try {
    const items = fs.readdirSync(TRASH_DIR);
    const now = Date.now();
    for (const item of items) {
      const fullPath = path.join(TRASH_DIR, item);
      const stat = fs.statSync(fullPath);
      const ageDays = (now - stat.mtime.getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > TRASH_RETENTION_DAYS) {
        if (stat.isDirectory()) fs.rmSync(fullPath, { recursive: true });
        else fs.unlinkSync(fullPath);
        logger.info('Cleaned up trash item', { item });
      }
    }
  } catch (e) { /* ignore */ }
}, 24 * 60 * 60 * 1000);

export default router;
