import { Module } from '@nestjs/common';
import { OnchainTransactionsService } from './onchain-transactions.service';
import { OnchainTransactionsController } from './onchain-transactions.controller';
import { WalletSystemModule } from 'src/common/primary_services/wallet-systems/WalletSystem.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletEntity } from './entities/wallet.entity';
import { TransactionEntity } from './entities/transaction.entity';
import { StakeEntity } from './entities/stake.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WalletEntity, TransactionEntity, StakeEntity]), WalletSystemModule],
  controllers: [OnchainTransactionsController],
  providers: [OnchainTransactionsService],
})
export class OnchainTransactionsModule {}
