import { Client as SshClient } from 'ssh2';
import * as fs from 'fs';
import logger from '../utils/logger.js';

export class SftpService {
  private conn: SshClient | null = null;
  private sftp: any = null;

  connect(host: string, port: number, username: string, password?: string, privateKey?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = new SshClient();
      conn.on('ready', () => {
        conn.sftp((err, sftp) => {
          if (err) {
            conn.end();
            return reject(new Error(`SFTP subsystem error: ${err.message}`));
          }
          this.conn = conn;
          this.sftp = sftp;
          logger.info('SFTP connected', { host, username });
          resolve();
        });
      }).on('error', (err) => {
        reject(new Error(`Connection failed: ${err.message}`));
      }).connect({
        host,
        port: port || 22,
        username,
        password,
        privateKey: privateKey ? fs.readFileSync(privateKey, 'utf8') : undefined,
        readyTimeout: parseInt(process.env.SFTP_TIMEOUT || '30000'),
      });
    });
  }

  list(dirPath: string = '/'): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.sftp) return reject(new Error('Not connected'));
      this.sftp.readdir(dirPath, (err: any, list: any[]) => {
        if (err) return reject(err);
        const files = list.map(f => ({
          name: f.filename,
          type: f.longname.startsWith('d') ? 'dir' : 'file',
          size: f.attrs.size,
          modifyTime: new Date(f.attrs.mtime * 1000).toISOString(),
          permissions: f.longname.split(' ')[0],
          owner: f.attrs.uid.toString(),
          group: f.attrs.gid.toString(),
        }));
        resolve(files);
      });
    });
  }

  readFile(remotePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.sftp) return reject(new Error('Not connected'));
      const buffers: Buffer[] = [];
      const stream = this.sftp.createReadStream(remotePath);
      stream.on('data', (chunk: Buffer) => buffers.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(buffers).toString('utf8')));
      stream.on('error', reject);
    });
  }

  writeFile(remotePath: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.sftp) return reject(new Error('Not connected'));
      const stream = this.sftp.createWriteStream(remotePath);
      stream.write(content, 'utf8');
      stream.end();
      stream.on('close', () => resolve());
      stream.on('error', reject);
    });
  }

  delete(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.sftp) return reject(new Error('Not connected'));
      this.sftp.unlink(path, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  rename(oldPath: string, newPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.sftp) return reject(new Error('Not connected'));
      this.sftp.rename(oldPath, newPath, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  mkdir(dirPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.sftp) return reject(new Error('Not connected'));
      this.sftp.mkdir(dirPath, { recursive: true }, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  close(): void {
    if (this.conn) {
      this.conn.end();
      this.conn = null;
      this.sftp = null;
    }
  }
}
