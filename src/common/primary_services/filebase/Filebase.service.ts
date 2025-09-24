import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import Ajv, { ErrorObject } from 'ajv';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { parse } from 'csv-parse/sync';
import * as xlsx from 'xlsx';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

// Load master schema definitions
import masterDataSchemas from './master_data_schemas.json';
import { allowedExtensions } from 'src/common/constants/file.constant';

const ajv = new Ajv();

@Injectable()
export class FilebaseService {
  private bucket: string;
  private s3: S3Client;
  private schemaCache: Record<string, any> = {};
  private readonly AllowedExtensions = allowedExtensions

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

    // Pre-generate AJV schemas
    this.schemaCache = this.generateAjvSchemas();
  }


  /**
   * 🔹 Get Schema Validator
   */
  private getValidator(schemaKey: string) {
    const schema = this.schemaCache[schemaKey];
    if (!schema) throw new Error(`Schema not found: ${schemaKey}`);
    return ajv.compile(schema);
  }


  /**
   * 🔹 Generate AJV schemas dynamically from master schema definition
   */
  private generateAjvSchemas() {
    const schemas: Record<string, any> = {};

    for (const [category, fields] of Object.entries(masterDataSchemas)) {
      schemas[category] = {
        type: 'object',
        properties: Object.fromEntries(
          (fields as string[]).map((field) => [
            field,
            { type: ['string', 'number', 'boolean', 'object', 'array', 'null'] },
          ]),
        ),
        required: fields,
        additionalProperties: false, // reject unknown fields
      };
    }

    return schemas;
  }


  /**
   * 🔹 Duplicate check inside a file
   */
  private checkUniqueInFile(data: any[]): string[] {
    const seen = new Set();
    const duplicates: string[] = [];
    data.forEach((row, i) => {
      const key = JSON.stringify(row);
      if (seen.has(key)) duplicates.push(`Duplicate at row ${i}`);
      else seen.add(key);
    });
    return duplicates;
  }


  /**
   * 🔹 Compute file hash for integrity
   */
  private computeFileHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }


  /**
   * 🔹 Get existing Schema Keys
   */
  public getSchemaKeys(): string[] {
    return Object.keys(this.schemaCache);
  }

  /**
   * 🔹 Get existing Schema Key properties
   */
  public getSchemaKeyProperties(schemaKey: string): string[] {
    return this.schemaCache[schemaKey]
  }


  /**
   * 🔹 Upload file to Filebase S3
   */
  public async uploadFile(file: Express.Multer.File) {
    const uniqueKey = `${uuid()}-${file.originalname}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: uniqueKey,
        Body: file.buffer,
      }),
    );

    const metadata = await this.s3.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: uniqueKey,
      }),
    );

    const cid = metadata.Metadata?.cid;

    return {
      key: uniqueKey,
      cid: cid || null,
      s3Url: `https://s3.filebase.com/${this.bucket}/${uniqueKey}`,
      ipfsUrl: cid ? `https://ipfs.filebase.io/ipfs/${cid}` : null,
      hash: this.computeFileHash(file.buffer),
    };
  }


  /**
   * 🔹 Download file from Filebase
   */
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


  /**
   * 🔹 Get File Info (S3 + IPFS)
   */
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


  /**
   * 🔹 Validate uploaded JSON/CSV file before storage
   */
  // public validateFile(file: Express.Multer.File, schemaKey: string) {
  //   const extension = file.originalname.split('.').pop()?.toLowerCase();
  //   const rowReports: Array<{ row: number; valid: boolean; errors: string[] }> = [];
  //   let data: any[] = [];

  //   try {
  //     // 🔹 Parse file into objects
  //     if (extension === 'json') {
  //       data = JSON.parse(file.buffer.toString());
  //       if (!Array.isArray(data)) data = [data];
  //     } else if (extension === 'csv') {
  //       data = parse(file.buffer.toString(), { columns: true, skip_empty_lines: true });
  //     } else {
  //       return { valid: false, totalRecords: 0, errors: ['Unsupported file type'] };
  //     }

  //     // 🔹 Use compiled schema validator
  //     const validate = this.getValidator(schemaKey);

  //     data.forEach((entry, idx) => {
  //       const valid = validate(entry);
  //       rowReports.push({
  //         row: idx,
  //         valid: !!valid,
  //         errors: valid ? [] : (validate.errors || []).map(e => `${(e as any).instancePath || (e as any).dataPath || ''} ${e.message}`),
  //       });
  //     });

  //   } catch (err) {
  //     return {
  //       valid: false,
  //       totalRecords: 0,
  //       errors: [`Parsing error: ${(err as Error).message}`],
  //       rowReports: [],
  //     };
  //   }

  //   // 🔹 Duplicates
  //   const dupes = this.checkUniqueInFile(data);
  //   const hasErrors = rowReports.some(r => !r.valid) || dupes.length > 0;

  //   return {
  //     valid: !hasErrors,
  //     totalRecords: data.length,
  //     errors: dupes, // global duplicate issues
  //     rowReports,    // detailed row-by-row issues
  //   };
  // }

  public validateFile(file: Express.Multer.File, schemaKey: string) {
    const extension = `.${file.originalname.split('.').pop()?.toLowerCase()}`;
    if (!this.AllowedExtensions.includes(extension)) {
      throw new BadRequestException(`File type ${extension} not allowed`);
    }

    const rowReports: Array<{ row: number; valid: boolean; errors: string[] }> = [];
    let data: any[] = [];

    try {
      if (extension === '.json') {
        data = JSON.parse(file.buffer.toString());
        if (!Array.isArray(data)) data = [data];
      } else if (extension === '.csv') {
        data = parse(file.buffer.toString(), { columns: true, skip_empty_lines: true });
      } else if (extension === '.xls' || extension === '.xlsx') {
        const workbook = xlsx.read(file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
      } else if (['.txt', '.sol', '.abi', '.xml'].includes(extension)) {
        // treat as plain text lines or raw content
        const content = file.buffer.toString();
        data = content.split('\n').map((line, i) => ({ lineNumber: i, content: line }));
        // skip schema validation for plain-text formats
        return {
          valid: true,
          totalRecords: data.length,
          errors: [],
          rowReports: [],
        };
      }

      // 🔹 Use compiled schema validator (only for structured formats)
      const validate = this.getValidator(schemaKey);
      data.forEach((entry, idx) => {
        const valid = validate(entry);
        rowReports.push({
          row: idx,
          valid: !!valid,
          errors: valid ? [] : (validate.errors || []).map(e => `${(e as any).instancePath || ''} ${e.message}`),
        });
      });
    } catch (err) {
      return {
        valid: false,
        totalRecords: 0,
        errors: [`Parsing error: ${(err as Error).message}`],
        rowReports: [],
      };
    }

    // 🔹 Duplicates
    const dupes = this.checkUniqueInFile(data);
    const hasErrors = rowReports.some(r => !r.valid) || dupes.length > 0;

    return {
      valid: !hasErrors,
      totalRecords: data.length,
      errors: dupes,
      rowReports,
    };
  }

}
