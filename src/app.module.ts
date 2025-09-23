import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DB_ConfigModule } from './common/db/config.module';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { FilebaseModule } from './common/primary_services/filebase/Filebase.module';
import { WalletSystemModule } from './common/primary_services/wallet-systems/WalletSystem.module';
import { UploadRouteModule } from './upload-route/upload-route.module';
import { OnchainTransactionsModule } from './onchain-transactions/onchain-transactions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: ['.env'],
    validationSchema: Joi.object({
      PORT: Joi.number().default(3000),
      POSTGRES_URL: Joi.string().required(),
      POSTGRES_HOST: Joi.string().required(),
      POSTGRES_PORT: Joi.number().required(),
      POSTGRES_USER: Joi.string().required(),
      POSTGRES_PASSWORD: Joi.string().required(),
      POSTGRES_DB: Joi.string().required(),
      WALLET_SECRET_KEY: Joi.string().required(),
      JWT_SECRET: Joi.string().required(),
      INFURA_API_KEY_SECRET: Joi.string().required(),
      INFURA_API_KEY: Joi.string().required(),
      INFURA_ETHEREUM_RPC_URL: Joi.string().required(),
      RPC_SEPOLIA_URL: Joi.string().required(),
      MASTER_ENCRYPTION_KEY: Joi.string().required(),
      MASTER_MNEMONIC: Joi.string().required(),
      MASTER_ADDRESS: Joi.string().required(),
      OPENAI_API_KEY: Joi.string().required(),
      MASTER_REWARD_PRIVATE_KEY: Joi.string().required(),
      FILEBASE_ACCESS_KEY: Joi.string().required(),
      FILEBASE_SECRET_KEY: Joi.string().required(),
      FILEBASE_BUCKET: Joi.string().required(),
      NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
    })
  }),
    DB_ConfigModule,
    FilebaseModule,
    WalletSystemModule,
    UploadRouteModule,
    OnchainTransactionsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
