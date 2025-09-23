import { Injectable, Inject } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import OpenAI from 'openai';

@Injectable()
export class AIValidationService {
  constructor(@Inject('OPENAI_CLIENT') private readonly openai: OpenAI) {}

  private async checkTextForAnomalies(fieldName: string, text: string): Promise<string[]> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini', // Model type
      messages: [
        {
          role: 'system',
          content: `You are a security and data validation AI. 
          Task: Check text for anomalies, malicious injections, or nonsense.
          Respond with a JSON array of issues. If none, return [].`,
        },
        {
          role: 'user',
          content: `Field: ${fieldName}\nValue: ${text}`,
        },
      ],
      temperature: 0,
    });

    try {
      return JSON.parse(response.choices[0].message.content || '[]');
    } catch {
      return ['AI response could not be parsed'];
    }
  }


  private async checkRecord(record: Record<string, any>): Promise<Record<string, string[]>> {
    const results: Record<string, string[]> = {};

    for (const [key, value] of Object.entries(record)) {
      if (typeof value === 'string') {
        results[key] = await this.checkTextForAnomalies(key, value);
      }
    }

    return results;
  }


  /**
   * 🔹 Validate an uploaded file (JSON or CSV buffer)
   */
  public async checkFile(file: Express.Multer.File): Promise<
    Array<{
      row: number;
      issues: Record<string, string[]>;
    }>
  > {
    const extension = file.originalname.split('.').pop()?.toLowerCase();
    let records: Record<string, any>[] = [];

    // 🔹 Parse file
    if (extension === 'json') {
      const parsed = JSON.parse(file.buffer.toString());
      records = Array.isArray(parsed) ? parsed : [parsed];
    } else if (extension === 'csv') {
      records = parse(file.buffer.toString(), { columns: true, skip_empty_lines: true });
    } else {
      throw new Error('Unsupported file type. Only JSON or CSV allowed.');
    }

    // 🔹 Run AI validation row by row
    const results: Array<{ row: number; issues: Record<string, string[]> }> = [];
    for (let i = 0; i < records.length; i++) {
      const issues = await this.checkRecord(records[i]);
      results.push({ row: i, issues });
    }

    return results;
  }
}
