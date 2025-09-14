import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { WalletSystemService } from 'src/common/primary_services/wallet-systems/WalletSystem.service';
import { InjectRepository } from '@nestjs/typeorm';
import { WalletEntity } from './entities/wallet.entity';
import { Repository } from 'typeorm';
import { TransactionEntity } from './entities/transaction.entity';
import { StakeEntity } from './entities/stake.entity';
import * as fs from 'fs';
import { FilebaseService } from 'src/common/primary_services/filebase/Filebase.service';

@Injectable()
export class OnchainTransactionsService {
  constructor(
    @InjectRepository(WalletEntity)
    private walletRepo: Repository<WalletEntity>,

    @InjectRepository(TransactionEntity)
    private txRepo: Repository<TransactionEntity>,

    @InjectRepository(StakeEntity)
    private stakeRepo: Repository<StakeEntity>,

    private readonly walletSystem: WalletSystemService,
    private readonly filebaseService: FilebaseService
  ) { }

  private async wallet_staked_repo(userId: string, stakeId: number) {
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    const staked = await this.stakeRepo.findOne({ where: { userId, id: stakeId } });
    if (!wallet) throw new NotFoundException('User wallet not found');
    if (!staked) throw new NotFoundException('User Staked not found');
    return { wallet, staked };
  }

  /**
  * Create a new wallet for a user and save to DB
  */
  async createUserWallet(userId: string) {
    const existing = await this.walletRepo.findOne({ where: { userId } });
    if (existing) throw new ConflictException('Wallet already exists for this user');

    const userWallet = await this.walletSystem.createUserWallet();

    const jsonFormat = JSON.stringify({ ...userWallet, privateKey: userWallet.privateKey, createdAt: new Date().toISOString(), userId }, null, 2)
    const filePath = `${userId}-wallet.json`;
    await fs.promises.writeFile(filePath, jsonFormat, 'utf8');
    const fileBuffer = await fs.promises.readFile(filePath);

    const userFile: Express.Multer.File = {
      fieldname: 'wallet',
      originalname: `${userId}-wallet.json`,
      encoding: 'utf8',
      mimetype: 'application/json',
      size: fileBuffer.length,
      buffer: fileBuffer,
      destination: '',
      filename: `${userId}-wallet.json`,
      path: filePath,
      stream: undefined as any,
    };
    const saveFile = await this.filebaseService.uploadFile(userFile)
    const encryptedPrivateKey = this.walletSystem.aesEncrypt(userWallet.privateKey);
    const entity = this.walletRepo.create({
      userId,
      address: userWallet.address,
      wallet_encrpt: {
        key: saveFile.key,
        s3Url: saveFile.s3Url,
        ipfsUrl: saveFile.ipfsUrl ?? '',
        cid: saveFile.cid ?? ''
      },
      encryptedPrivateKey,
      chain: 'ETH',
    });

    return { message: 'Wallet created Successfully', success: true, data: await this.walletRepo.save(entity) };
  }

  /**
  * retrieve user wallet from db
  */
  async getUserWallet(userId: string) {
    const existing = await this.walletRepo.findOne({ where: { userId } });
    if (!existing) throw new ConflictException("Wallet dosen't exists for this user");
    return { message: 'Wallet retrieved Successfully', success: true, data: existing }
  }

  /**
  * get user balance from the wallet  */
  async getUserBalance(userId: string) {
    const existing = await this.walletRepo.findOne({ where: { userId } });
    if (!existing) throw new NotFoundException('Wallet not found for this user');

    const balance = await this.walletSystem.getBalance(existing.address)
    return { message: 'User balance fetched Successfully', success: true, data: balance };
  }

  /**
  * get user Eth balance from the wallet  */
  async getEthBalance(userId: string) {
    const existing = await this.walletRepo.findOne({ where: { userId } });
    if (!existing) throw new NotFoundException('Wallet not found for this user');
    const balance = await this.walletSystem.getEthBalance(existing.address)
    return { message: 'User Eth balance fetched Successfully', success: true, data: balance };
  }

  /**
   * Send tokens from a user wallet to another address
   */
  async sendTokens(userId: string, to: string, amount: string, gasLimit?: bigint) {
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('User wallet not found');

    try {
      const result = await this.walletSystem.sendTokenFromUser(
        wallet.encryptedPrivateKey,
        to,
        amount,
        gasLimit
      );

      const tx = this.txRepo.create({
        userId,
        to,
        token: 'LOT',
        amount,
        fee: ((parseFloat(amount) * 1) / 100).toString(),
        userTxHash: result.userTx.hash,
        feeTxHash: result.feeTx.hash,
        blockNumber: result.userTx.blockNumber,
        status: result.userTx.status === 1 ? 'success' : 'failed',
        wallet,
      });

      return { message: 'Transaction created Successfully', success: true, data: await this.txRepo.save(tx) }
    } catch (error) {
      console.log(error)
      throw new InternalServerErrorException(error.message ?? 'Failed to send tokens');
    }
  }

  /**
   * Stake tokens into a pool
   */
  async stakeTokens(userId: string, amount: string, poolId: number) {
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('User wallet not found');

    try {
      const result = await this.walletSystem.stakeTokensFromUser(
        wallet.encryptedPrivateKey,
        amount,
        poolId,
      );

      const stake = this.stakeRepo.create({
        amount,
        approveTxHash: result.approveTxHash,
        stakeTxHash: result.stakeTxHash,
        blockNumber: result.blockNumber,
        status: result.status === 1 ? 'success' : 'failed',
        contractStakeId: result.contractStakeId,
        wallet,
      });

      return { message: 'Token Staked Successfully', success: true, data: await this.stakeRepo.save(stake) };
    } catch (error) {
      throw new InternalServerErrorException('Failed to stake tokens');
    }
  }

  /**
   * Claim rewards for a stake
   */
  async claimRewards(userId: string, stakeId: number) {
    const { wallet, staked } = await this.wallet_staked_repo(userId, stakeId);

    try {
      const result = await this.walletSystem.claimRewards(wallet.encryptedPrivateKey, staked.contractStakeId);

      // Save claim as a transaction
      const tx = this.txRepo.create({
        to: wallet.address,
        token: 'LOT',
        amount: '0', // Rewards amount isn’t always known beforehand
        fee: '0',
        userTxHash: result.txHash,
        feeTxHash: '', // no fee tx for claims
        blockNumber: result.blockNumber,
        status: result.status === 1 ? 'success' : 'failed',
        wallet,
      });

      await this.txRepo.save(tx);

      return { message: 'Reward claimed Successfully', success: true, data: tx };
    } catch (error) {
      throw new InternalServerErrorException('Failed to claim rewards');
    }
  }

  /**
   * Unstake tokens
   */
  async unstakeTokens(userId: string, stakeId: number) {
    const { wallet, staked } = await this.wallet_staked_repo(userId, stakeId)

    try {
      const result = await this.walletSystem.unstakeTokens(wallet.encryptedPrivateKey, staked.contractStakeId);

      // const stake = await this.stakeRepo.findOne({ where: { id: stakeId, wallet: { id: wallet.id } } });
      staked.status = result.status === 1 ? 'success' : 'failed';
      await this.stakeRepo.save(staked);

      // Save unstake as a transaction
      const tx = this.txRepo.create({
        to: wallet.address,
        token: 'LOT',
        amount: staked?.amount ?? '0',
        fee: '0',
        userTxHash: result.txHash,
        feeTxHash: '',
        blockNumber: result.blockNumber,
        status: result.status === 1 ? 'success' : 'failed',
        wallet,
      });

      await this.txRepo.save(tx);

      return { message: 'Reward claimed Successfully', success: true, data: tx };
    } catch (error) {
      throw new InternalServerErrorException('Failed to unstake tokens');
    }
  }

  /**
   * staked token rewards
   */
  async getPendingRewards(userId: string, stakeId: number) {
    const { wallet, staked } = await this.wallet_staked_repo(userId, stakeId)
    const result = this.walletSystem.getPendingRewards(wallet.address, staked.contractStakeId)
    return { message: 'Pending rewards fetched Successfully', success: true, data: result };
  }

  /**
   * Fetch user transactions
   */
  async getUserTransactions(userId: string, limit: number = 50, page: number = 1) {
    limit = Math.max(1, Math.min(limit, 100))
    page = Math.max(1, page)
    const offset = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      await this.txRepo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        skip: offset,
        take: limit,
      }),
      await this.txRepo.count({ where: { userId } })
    ])
    const totalPages = total === 0 ? 1 : Math.ceil(total / limit);

    return {
      message: 'User transactions fetched successfully', success: true, data: {
        transactions,
        page,
        total,
        totalPages,
        user: {
          userId
        }
      }
    };
  }

  /**
   * Fetch user stakes
   */
  async getUserStakes(userId: string, limit: number = 50, page: number = 1) {
    limit = Math.max(1, Math.min(limit, 100))
    page = Math.max(1, page)
    const offset = (page - 1) * limit;
    const [stakes, total] = await Promise.all([
      await this.stakeRepo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        skip: offset,
        take: limit,
      }),
      await this.stakeRepo.count({ where: { userId } })
    ])
    const totalPages = total === 0 ? 1 : Math.ceil(total / limit);

    return {
      message: 'User stakes fetched successfully', success: true, data: {
        stakes,
        page,
        total,
        totalPages,
        user: {
          userId
        }
      }
    };
  }

  /**
   * Fetch user stakes stats
   */
  async getUserStakesStats(userId: string) {
    const stakes = await this.walletSystem.getUserStakesStats(userId);
    return { message: 'User stakes stats fetched successfully', success: true, data: stakes }
  }

  /**
    * Get general staking contract stats.
    */
  async getStakingStats() {
    return { message: 'Staking stats fetched successfully', success: true, data: await this.walletSystem.getContractStats() }
  }
}