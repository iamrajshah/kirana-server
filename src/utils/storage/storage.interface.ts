import { Readable } from 'stream';

export interface FileMetadata {
  key: string;
  size: number;
  mimeType: string;
  originalName: string;
}

export interface UploadOptions {
  tenantId: string;
  originalName: string;
  mimeType: string;
  buffer?: Buffer;
  stream?: Readable;
}

export interface IFileStorage {
  /**
   * Upload file to storage
   */
  upload(options: UploadOptions): Promise<FileMetadata>;

  /**
   * Get file as stream
   */
  getStream(key: string): Promise<Readable>;

  /**
   * Get file as buffer
   */
  getBuffer(key: string): Promise<Buffer>;

  /**
   * Delete file from storage
   */
  delete(key: string): Promise<void>;

  /**
   * Check if file exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get file metadata
   */
  getMetadata(key: string): Promise<FileMetadata | null>;
}
