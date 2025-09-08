import { Module } from '@nestjs/common';
import { UploadRouteService } from './upload-route.service';
import { UploadRouteController } from './upload-route.controller';
import { dataFilesTable, smartContractTable } from './entities/upload-route.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilebaseModule } from 'src/common/primary_services/filebase/Filebase.module';

@Module({
  imports: [TypeOrmModule.forFeature([smartContractTable, dataFilesTable]), FilebaseModule],
  controllers: [UploadRouteController],
  providers: [UploadRouteService],
})
export class UploadRouteModule {}
