import {
   Entity,
   PrimaryGeneratedColumn,
   Column,
   CreateDateColumn,
   UpdateDateColumn
} from 'typeorm';

@Entity({ name: 'smartContractTables' }) // table name in DB
export class smartContractTable {
   @PrimaryGeneratedColumn()
   id: number;

   @Column({ type: 'varchar', unique: true })
   userID: string;

   @Column({ type: 'varchar', length: 255 })
   name: string;

   @Column({ type: 'varchar', unique: true })
   uploadAccessKey: string;

   @Column({ type: 'varchar', nullable: true })
   CID: string; // content identifier (optional)

   @Column({ type: 'varchar', length: 50 })
   mimetype: string; // e.g., "json", "csv", "sol"

   @Column({ type: 'varchar', length: 50 })
   contractType: string;

   @Column({ type: 'int', default: 0 })
   linkedDevices: number;

   @Column({ type: 'text', nullable: true })
   linkedRules: string; // JSON string or rules description

   @CreateDateColumn({ type: 'timestamp' })
   createdAt: Date;

   @UpdateDateColumn({ type: 'timestamp' })
   updatedAt: Date;
}

@Entity({ name: 'dataFilesTables' })
export class dataFilesTable {
   @PrimaryGeneratedColumn()
   id: number;

   @Column({ type: 'varchar', unique: true })
   userID: string;

   @Column({ type: 'varchar', length: 255 })
   name: string;

   @Column({ type: 'varchar', unique: true })
   uploadAccessKey: string;

   @Column({ type: 'varchar', nullable: true })
   CID: string; // content identifier (optional)

   @Column({ type: 'varchar', length: 50 })
   accessType: string;

   @Column({ type: 'varchar', length: 50 })
   mimetype: string; // e.g., "json", "csv", "sol"
   
   @CreateDateColumn({ type: 'timestamp' })
   createdAt: Date;

   @UpdateDateColumn({ type: 'timestamp' })
   updatedAt: Date;
}