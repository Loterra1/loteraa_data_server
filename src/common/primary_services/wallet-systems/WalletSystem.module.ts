import { Module } from '@nestjs/common';
import { WalletSystemService } from './WalletSystem.service';

@Module({
  imports: [],
  controllers: [],
  providers: [WalletSystemService],
  exports: [WalletSystemService]
})
export class WalletSystemModule {}