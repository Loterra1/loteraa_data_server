import { IsString } from "class-validator";

export class CreateOnchainTransactionDto {}

export class createWalletDto {
   @IsString()
   userId: string;
}

export class SendEthDto {
   @IsString()
   userId: string;

   @IsString()
   address: string;

   @IsString()
   amount: number;
}