import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';


@Module({
   imports: [
      TypeOrmModule.forRootAsync({
         inject: [ConfigService],
         useFactory: (configService: ConfigService) => {
            const isProd = configService.get<string>('NODE_ENV') === 'production';
            console.log('is Production: ', isProd, configService.get<string>('NODE_ENV'))
            return {
               type: 'postgres',
               // url: configService.get<string>('POSTGRES_URL'),
               host: configService.get<string>('POSTGRES_HOST'),
               port: configService.get<number>('POSTGRES_PORT'),
               username: configService.get<string>('POSTGRES_USER'),
               password: configService.get<string>('POSTGRES_PASSWORD'),
               database: configService.get<string>('POSTGRES_DB'), 
               synchronize: true,
               autoLoadEntities: true, 
               ssl: { rejectUnauthorized: isProd },
            }
         }
      })
   ],
   controllers: [],
   providers: [],
   exports: [TypeOrmModule]
})
export class DB_ConfigModule { }