import { Module } from '@nestjs/common';
import { config } from 'dotenv';
import OpenAI from 'openai';
import { AIValidationService } from './openai.service';
config()

@Module({
  providers: [
    {
      provide: 'OPENAI_CLIENT',
      useFactory: () => {
        return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      },
    },
    AIValidationService
  ],
  exports: ['OPENAI_CLIENT', AIValidationService],
})
export class OpenAIModule {}
