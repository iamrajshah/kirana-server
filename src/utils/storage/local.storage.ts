import { IFileStorage, FileMetadata, UploadOptions } from './storage.interface';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);

/**
 * Local file storage implementation for development
 */
export class LocalFileStorage implements IFileStorage {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.join(process.cwd(), 'uploads', 'imports');
    this.ensureDirectory();
  }

  private async ensureDirectory(): Promise<void> {
    if (!fs.existsSync(this.baseDir)) {
      await mkdir(this.baseDir, { recursive: true });
    }
  }

  private getFilePath(key: string): string {
    return path.join(this.baseDir, key);
  }

  async upload(options: UploadOptions): Promise<FileMetadata> {
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const ext = path.extname(options.originalName);
    const key = `import-${options.tenantId}-${timestamp}-${random}${ext}`;
    const filePath = this.getFilePath(key);

    if (options.buffer) {
      await writeFile(filePath, options.buffer);
    } else if (options.stream) {
      await this.writeStream(filePath, options.stream);
    } else {
      throw new Error('Either buffer or stream must be provided');
    }

    const stats = await stat(filePath);

    return {
      key,
      size: stats.size,
      mimeType: options.mimeType,
      originalName: options.originalName,
    };
  }

  private async writeStream(filePath: string, stream: Readable): Promise<void> {
    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(filePath);
      stream.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      stream.on('error', reject);
    });
  }

  async getStream(key: string): Promise<Readable> {
    const filePath = this.getFilePath(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }
    return fs.createReadStream(filePath);
  }

  async getBuffer(key: string): Promise<Buffer> {
    const filePath = this.getFilePath(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }
    return readFile(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key);
    if (fs.existsSync(filePath)) {
      await unlink(filePath);
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);
    return fs.existsSync(filePath);
  }

  async getMetadata(key: string): Promise<FileMetadata | null> {
    const filePath = this.getFilePath(key);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const stats = await stat(filePath);
    return {
      key,
      size: stats.size,
      mimeType: 'application/octet-stream',
      originalName: key,
    };
  }
}
