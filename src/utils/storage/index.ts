import { IFileStorage } from './storage.interface';
import { LocalFileStorage } from './local.storage';
import { S3FileStorage } from './s3.storage';
import { config } from '@config/env';

export * from './storage.interface';
export * from './local.storage';
export * from './s3.storage';

/**
 * Storage factory - returns appropriate storage based on environment
 */
export function createFileStorage(): IFileStorage {
  const storageType = config.storageType || 'local';

  switch (storageType) {
    case 'local':
      return new LocalFileStorage();

    case 's3':
      return new S3FileStorage();

    default:
      // Default to local for development
      if (config.env === 'development') {
        return new LocalFileStorage();
      }
      throw new Error(`Unknown storage type: ${storageType}`);
  }
}

// Singleton instance
let storageInstance: IFileStorage | null = null;

/**
 * Get file storage instance
 */
export function getFileStorage(): IFileStorage {
  if (!storageInstance) {
    storageInstance = createFileStorage();
  }
  return storageInstance;
}
