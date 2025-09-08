import {
   Entity,
   PrimaryGeneratedColumn,
   Column,
   CreateDateColumn,
   UpdateDateColumn,
   OneToMany,
} from 'typeorm';
import { TransactionEntity } from './transaction.entity';
import { StakeEntity } from './stake.entity';

@Entity({ name: 'wallets' })
export class WalletEntity {
   @PrimaryGeneratedColumn()
   id: number;

   @Column({ unique: true })
   userId: string; // from your app’s user system

   @Column({ unique: true })
   address: string;

   @Column()
   encryptedPrivateKey: string; // stored encrypted using AES key

   @Column({ default: 'ETH' })
   chain: string;

   @CreateDateColumn({ type: 'timestamp' })
   createdAt: Date;

   @UpdateDateColumn({ type: 'timestamp' })
   updatedAt: Date;

   // Relations
   @OneToMany(() => TransactionEntity, (tx) => tx.wallet)
   transactions: TransactionEntity[];

   @OneToMany(() => StakeEntity, (stake) => stake.wallet)
   stakes: StakeEntity[];
}

