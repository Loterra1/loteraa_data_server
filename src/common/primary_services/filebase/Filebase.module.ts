import { Module } from '@nestjs/common';
import { FilebaseService } from './Filebase.service';

@Module({
  imports: [],
  controllers: [],
  providers: [FilebaseService],
  exports: [FilebaseService]
})
export class FilebaseModule {}