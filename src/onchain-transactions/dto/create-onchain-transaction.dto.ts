import { IsString } from "class-validator";

export class CreateOnchainTransactionDto {}

export class createWalletDto {
   @IsString()
   userId: string;
}