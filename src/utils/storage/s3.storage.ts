import { IFileStorage, FileMetadata, UploadOptions } from './storage.interface';
import { Readable } from 'stream';

/**
 * S3-compatible storage implementation (S3, MinIO, etc.)
 *
 * To use this storage:
 * 1. Install AWS SDK: npm install @aws-sdk/client-s3 @aws-sdk/lib-storage
 * 2. Add environment variables:
 *    - S3_ENDPOINT (optional, for MinIO)
 *    - S3_REGION
 *    - S3_ACCESS_KEY_ID
 *    - S3_SECRET_ACCESS_KEY
 *    - S3_BUCKET_NAME
 * 3. Uncomment the implementation below
 */

export class S3FileStorage implements IFileStorage {
  // private s3Client: S3Client;
  // private bucket: string;

  constructor() {
    throw new Error(
      'S3FileStorage not implemented yet. ' +
        'Install @aws-sdk/client-s3 and configure environment variables. ' +
        'See src/utils/storage/s3.storage.ts for details.'
    );

    // Example implementation:
    /*
    import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
    import { Upload } from '@aws-sdk/lib-storage';
    
    this.bucket = process.env.S3_BUCKET_NAME!;
    this.s3Client = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT, // For MinIO
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: !!process.env.S3_ENDPOINT, // Required for MinIO
    });
    */
  }

  async upload(_options: UploadOptions): Promise<FileMetadata> {
    throw new Error('Not implemented');

    /* Example implementation:
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const ext = path.extname(options.originalName);
    const key = `imports/${options.tenantId}/${timestamp}-${random}${ext}`;

    const upload = new Upload({
      client: this.s3Client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: options.buffer || options.stream,
        ContentType: options.mimeType,
        Metadata: {
          originalName: options.originalName,
          tenantId: options.tenantId.toString(),
        },
      },
    });

    await upload.done();

    const headResult = await this.s3Client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key })
    );

    return {
      key,
      size: headResult.ContentLength || 0,
      mimeType: options.mimeType,
      originalName: options.originalName,
    };
    */
  }

  async getStream(_key: string): Promise<Readable> {
    throw new Error('Not implemented');

    /* Example implementation:
    const response = await this.s3Client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key })
    );
    return response.Body as Readable;
    */
  }

  async getBuffer(_key: string): Promise<Buffer> {
    throw new Error('Not implemented');

    /* Example implementation:
    const stream = await this.getStream(key);
    const chunks: Buffer[] = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
    */
  }

  async delete(_key: string): Promise<void> {
    throw new Error('Not implemented');

    /* Example implementation:
    await this.s3Client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    );
    */
  }

  async exists(_key: string): Promise<boolean> {
    throw new Error('Not implemented');

    /* Example implementation:
    try {
      await this.s3Client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key })
      );
      return true;
    } catch {
      return false;
    }
    */
  }

  async getMetadata(_key: string): Promise<FileMetadata | null> {
    throw new Error('Not implemented');

    /* Example implementation:
    try {
      const result = await this.s3Client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key })
      );
      
      return {
        key,
        size: result.ContentLength || 0,
        mimeType: result.ContentType || 'application/octet-stream',
        originalName: result.Metadata?.originalName || key,
      };
    } catch {
      return null;
    }
    */
  }
}
