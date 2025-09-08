import { PartialType } from '@nestjs/mapped-types';
import { CreateOnchainTransactionDto } from './create-onchain-transaction.dto';

export class UpdateOnchainTransactionDto extends PartialType(CreateOnchainTransactionDto) {}
