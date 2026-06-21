import { Client as FtpClient } from 'basic-ftp';
import logger from '../utils/logger.js';

export class FtpService {
  private client: FtpClient | null = null;

  async connect(host: string, port: number, username: string, password: string, secure: boolean): Promise<void> {
    const client = new FtpClient();
    client.ftp.verbose = process.env.LOG_LEVEL === 'debug';
    const timeout = parseInt(process.env.FTP_TIMEOUT || '30000');
    (client.ftp as any).timeout = timeout;

    await client.access({
      host,
      port: port || 21,
      user: username,
      password,
      secure,
    });
    this.client = client;
    logger.info('FTP connected', { host, username });
  }

  async list(dirPath: string = '/'): Promise<any[]> {
    if (!this.client) throw new Error('Not connected');
    const list = await this.client.list(dirPath);
    return list.map((f: any) => ({
      name: f.name,
      type: f.isDirectory ? 'dir' : 'file',
      size: f.size,
      modifyTime: f.modifiedAt ? new Date(f.modifiedAt).toISOString() : new Date().toISOString(),
      permissions: f.permissions ? String(f.permissions) : f.isDirectory ? 'drwxr-xr-x' : '-rw-r--r--',
      owner: f.user || 'Unknown',
      group: f.group || 'Unknown',
    }));
  }

  async readFile(remotePath: string): Promise<Buffer> {
    if (!this.client) throw new Error('Not connected');
    const tmpDir = '/tmp/nexusftp-read';
    const tmpFile = `${tmpDir}/__read_${Date.now()}`;
    await this.client.downloadTo(tmpFile, remotePath);
    const fs = await import('fs/promises');
    const content = await fs.readFile(tmpFile);
    await fs.unlink(tmpFile).catch(() => {});
    return content;
  }

  async writeFile(remotePath: string, content: string | Buffer): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    const tmpDir = '/tmp/nexusftp-write';
    const tmpFile = `${tmpDir}/__write_${Date.now()}`;
    const fs = await import('fs/promises');
    if (typeof content === 'string') {
      await fs.writeFile(tmpFile, content, 'utf8');
    } else {
      await fs.writeFile(tmpFile, content);
    }
    await this.client.uploadFrom(tmpFile, remotePath);
    await fs.unlink(tmpFile).catch(() => {});
  }

  async delete(path: string, type: 'file' | 'dir'): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    if (type === 'dir') {
      await this.client.removeDir(path);
    } else {
      await this.client.remove(path);
    }
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    await this.client.rename(oldPath, newPath);
  }

  async mkdir(dirPath: string): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    await this.client.ensureDir(dirPath);
  }

  close(): void {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
  }
}
