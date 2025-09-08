import {
   Entity,
   PrimaryGeneratedColumn,
   Column,
   ManyToOne,
   CreateDateColumn,
   UpdateDateColumn,
} from 'typeorm';
import { WalletEntity } from './wallet.entity';

@Entity({ name: 'stakes' })
export class StakeEntity {
   @PrimaryGeneratedColumn()
   id: number;

   @Column()
   userId: string; // from your app’s user system

   @Column('decimal', { precision: 36, scale: 18 })
   amount: string;

   @Column()
   approveTxHash: string;

   @Column()
   stakeTxHash: string;

   @Column({ nullable: true })
   blockNumber: number;

   @Column({ default: 'pending' })
   status: 'pending' | 'success' | 'failed';

   @Column()
   contractStakeId: number;

   @CreateDateColumn({ type: 'timestamp' })
   createdAt: Date;

   @UpdateDateColumn({ type: 'timestamp' })
   updatedAt: Date;

   // Relations
   @ManyToOne(() => WalletEntity, (wallet) => wallet.stakes, { onDelete: 'CASCADE' })
   wallet: WalletEntity;
}
