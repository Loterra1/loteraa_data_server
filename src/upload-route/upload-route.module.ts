import { Module } from '@nestjs/common';
import { UploadRouteService } from './upload-route.service';
import { UploadRouteController } from './upload-route.controller';
import { dataFilesTable, smartContractTable } from './entities/upload-route.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilebaseModule } from 'src/common/primary_services/filebase/Filebase.module';
import { OpenAIModule } from 'src/common/primary_services/openai/openai.module';
import { WalletSystemModule } from 'src/common/primary_services/wallet-systems/WalletSystem.module';
import { OnchainTransactionsModule } from 'src/onchain-transactions/onchain-transactions.module';

@Module({
  imports: [TypeOrmModule.forFeature([smartContractTable, dataFilesTable]), FilebaseModule, OpenAIModule, WalletSystemModule, OnchainTransactionsModule],
  controllers: [UploadRouteController],
  providers: [UploadRouteService],
})
export class UploadRouteModule {}
