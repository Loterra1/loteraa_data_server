import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

@Injectable()
export class FilebaseService {
  private bucket: string;
  private s3: S3Client;

  constructor(private config: ConfigService) {
    this.bucket = this.config.get<string>('FILEBASE_BUCKET')!;
    this.s3 = new S3Client({
      endpoint: 'https://s3.filebase.com',
      region: 'us-east-1',
      credentials: {
        accessKeyId: this.config.get<string>('FILEBASE_ACCESS_KEY')!,
        secretAccessKey: this.config.get<string>('FILEBASE_SECRET_KEY')!,
      },
    });
  }

  public async uploadFile(file: Express.Multer.File) {
    const uniqueKey = `${uuid()}-${file.originalname}`;

    // Upload file
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: uniqueKey,
        Body: file.buffer,
      }),
    );

    // Fetch metadata (CID provided by Filebase)
    const metadata = await this.s3.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: uniqueKey,
      }),
    );

    console.dir('metadata', metadata)

    const cid = metadata.Metadata?.['ipfs-hash'];

    return {
      key: uniqueKey,
      cid: cid || null,
      s3Url: `https://s3.filebase.com/${this.bucket}/${uniqueKey}`,
      ipfsUrl: cid ? `https://ipfs.filebase.io/ipfs/${cid}` : null,
    };
  }

  public async downloadFile(key: string): Promise<Buffer> {
    const result = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    const stream = result.Body as Readable;
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }

    return Buffer.concat(chunks);
  }

  public async getFileInfo(key: string) {
    const metadata = await this.s3.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    const cid = metadata.Metadata?.['ipfs-hash'];

    return {
      key,
      cid: cid || null,
      s3Url: `https://s3.filebase.com/${this.bucket}/${key}`,
      ipfsUrl: cid ? `https://ipfs.filebase.io/ipfs/${cid}` : null,
    };
  }
}
