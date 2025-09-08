import {
   Entity,
   PrimaryGeneratedColumn,
   Column,
   ManyToOne,
   CreateDateColumn,
   UpdateDateColumn,
} from 'typeorm';
import { WalletEntity } from './wallet.entity';

@Entity({ name: 'transactions' })
export class TransactionEntity {
   @PrimaryGeneratedColumn()
   id: number;

   @Column()
   userId: string; // from your app’s user system

   @Column()
   to: string;

   @Column()
   token: string; // LOT, ETH, etc.

   @Column('decimal', { precision: 36, scale: 18 })
   amount: string; // store as string to avoid float issues

   @Column('decimal', { precision: 36, scale: 18 })
   fee: string;

   @Column()
   userTxHash: string;

   @Column()
   feeTxHash: string;

   @Column({ nullable: true })
   blockNumber: number;

   @Column({ default: 'pending' })
   status: 'pending' | 'success' | 'failed';

   @CreateDateColumn({ type: 'timestamp' })
   createdAt: Date;

   @UpdateDateColumn({ type: 'timestamp' })
   updatedAt: Date;

   // Relations
   @ManyToOne(() => WalletEntity, (wallet) => wallet.transactions, { onDelete: 'CASCADE' })
   wallet: WalletEntity;
}
