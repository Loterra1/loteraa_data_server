import { ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ethers, JsonRpcProvider, HDNodeWallet, Contract } from 'ethers';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { CONTRACT_ABIS, CONTRACT_ADDRESSES, FEE_CONFIG, STAKING_POOLS } from '../../ABIs/contracts'
import type {
   ContractAddresses,
   NetworkConfig,
   StakingPool,
   FeeConfig,
   UserStake
} from '../../ABIs/types';
import { createHash } from "crypto";



@Injectable()
export class WalletSystemService {
   private provider: JsonRpcProvider
   private readonly MASTER_MNEMONIC: string;
   private readonly MASTER_ENCRYPTION_KEY: string;
   private readonly MASTER_ADDRESS: string
   private readonly ETHEREUM_RPC: string;
   private readonly contractAddresses: typeof CONTRACT_ADDRESSES;
   private readonly contractAbis: typeof CONTRACT_ABIS;
   private readonly StakingContract: Contract;
   private readonly TokenContract: Contract;


   constructor(private config: ConfigService) {
      this.MASTER_MNEMONIC = this.config.get<string>('MASTER_MNEMONIC')!;
      this.MASTER_ENCRYPTION_KEY = this.config.get<string>('MASTER_ENCRYPTION_KEY')!;
      this.MASTER_ADDRESS = this.config.get<string>('MASTER_ADDRESS')!;
      this.ETHEREUM_RPC = this.config.get<string>('INFURA_ETHEREUM_RPC_URL')!;
      this.provider = new JsonRpcProvider(this.ETHEREUM_RPC);
      this.contractAddresses = CONTRACT_ADDRESSES
      this.contractAbis = CONTRACT_ABIS
      this.StakingContract = new Contract(
         this.contractAddresses.LOT_STAKING,
         this.contractAbis.LOT_STAKING,
         this.provider,
      );
      this.TokenContract = new Contract(
         this.contractAddresses.LOT_TOKEN,
         this.contractAbis.LOT_TOKEN,
         this.provider,
      );
   }

   public aesEncrypt(plaintext: string): string { //returns hex string
      const key = Buffer.from(this.MASTER_ENCRYPTION_KEY, 'hex');
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      return Buffer.concat([iv, tag, encrypted]).toString('hex');
   }

   private aesDecrypt(cipherHex: string): string { //decrypts hex string
      try {
         const key = Buffer.from(this.MASTER_ENCRYPTION_KEY, 'hex');
         const data = Buffer.from(cipherHex, 'hex');
         const iv = data.slice(0, 12);
         const tag = data.slice(12, 28);
         const encrypted = data.slice(28);
         const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
         decipher.setAuthTag(tag);
         const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
         return decrypted.toString('utf8');
      } catch (error) {
         throw new InternalServerErrorException('Failed to decrypt private key');
      }
   }

   private async estimateGasWithBuffer(
      contract: Contract,
      methodName: string,
      params: any[],
      buffer: number = 20 // 20% buffer
   ): Promise<bigint> {
      try {
         const estimatedGas = await contract[methodName].estimateGas(...params);
         const gasWithBuffer = (estimatedGas * BigInt(100 + buffer)) / 100n;
         return gasWithBuffer;
      } catch (error) {
         console.warn(`Gas estimation failed for ${methodName}:`, error);
         // Fallback to higher default values based on operation complexity
         const fallbackGas = {
            'approve': 60_000n,
            'transfer': 65_000n,
            'stake': 250_000n,
            'unstake': 200_000n,
            'claimRewards': 150_000n,
         };
         return fallbackGas[methodName] || 100_000n;
      }
   }

   private async createSignerFromEncryptedKey(encryptedPrivateKey: string): Promise<ethers.Wallet> {
      const privateKey = this.aesDecrypt(encryptedPrivateKey);
      return new ethers.Wallet(privateKey, this.provider);
   }

   private _getNextIndex(userId: string): number {
      const hash = createHash("sha256").update(userId).digest("hex");
      const num = parseInt(hash.slice(0, 8), 16); // take first 8 hex chars
      return num % 2147483647; // clamp to valid BIP-32 index
   }


   async getAvailablePools() {
      return await this.StakingContract.getAllPools();
   }

   async getPoolInfo(poolId: number) {
      return await this.StakingContract.getPoolInfo(poolId);
   }

   async getBalance(address: string): Promise<{ etherFormatted: string; raw: string }> {
      const tokenContract = new Contract(this.contractAddresses.LOT_TOKEN, this.contractAbis.LOT_TOKEN, this.provider);
      const balance = await tokenContract.balanceOf(address);
      const decimals: number = await tokenContract.decimals();
      return { etherFormatted: ethers.formatUnits(balance, decimals), raw: balance.toString() };
   }

   async createUserWallet(): Promise<ethers.HDNodeWallet> {
      // const index = this._getNextIndex(userId);
      // const root = HDNodeWallet.fromPhrase(this.MASTER_MNEMONIC);
      // const child = root.derivePath(`m/44'/60'/0'/0/${index}`);

      // Create Wallet (signer) connected to provider
      // const wallet = new ethers.Wallet(child.privateKey, this.provider);

      const wallet = ethers.Wallet.createRandom();

      return wallet
   }

   async sendTokenFromUser(encryptedPrivateKey: string, to: string, amountTokens: string, gasLimit?: bigint): Promise<{
      userTx: {
         hash: string,
         blockNumber: number,
         status: number
      },
      feeTx: {
         hash: string,
         blockNumber: number,
         status: number
      }
   }> {
      const wallet = await this.createSignerFromEncryptedKey(encryptedPrivateKey);

      // Load token contract
      const tokenAddress = this.contractAddresses.LOT_TOKEN;
      const tokenAbi = this.contractAbis.LOT_TOKEN;
      const tokenContract = new Contract(tokenAddress, tokenAbi, wallet);

      // calculate service fee
      const decimals: number = await tokenContract.decimals();
      const amountBN = ethers.parseUnits(amountTokens, decimals);

      // Fee = 1% of amount
      const feeBN = (amountBN * 1n) / 100n;
      const netAmountBN = amountBN - feeBN;

      // Check balance
      const balance = await tokenContract.balanceOf(wallet.address);
      if (balance < amountBN) {
         throw new InternalServerErrorException(
            `Insufficient LOT balance. Wallet has ${ethers.formatUnits(
               balance,
               decimals
            )} LOT`
         );
      }

      // gas price / fee estimation
      const feeData = await this.provider.getFeeData();
      if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
         throw new InternalServerErrorException("Provider did not return EIP-1559 gas data");
      }

      // const finalGasLimit = gasLimit ?? 100_000n;

      try {

         // ✅ Estimate gas for user transfer
         const userGasLimit = gasLimit ?? await this.estimateGasWithBuffer(
            tokenContract,
            'transfer',
            [to, netAmountBN]
         );
         // 1) transfer net amount first and wait for confirmation
         const tx1 = await tokenContract.transfer(to, netAmountBN, {
            gasLimit: userGasLimit,
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
         });
         const receipt1 = await tx1.wait(1);


         // ✅ Estimate gas for fee transfer
         const feeGasLimit = gasLimit ?? await this.estimateGasWithBuffer(
            tokenContract,
            'transfer',
            [this.MASTER_ADDRESS, feeBN]
         );

         // 2) transfer fee to master address
         const tx2 = await tokenContract.transfer(this.MASTER_ADDRESS, feeBN, {
            gasLimit: feeGasLimit,
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
         });
         const receipt2 = await tx2.wait(1);

         return {
            userTx: { hash: receipt1.transactionHash ?? receipt1.hash, blockNumber: receipt1.blockNumber, status: receipt1.status },
            feeTx: { hash: receipt2.transactionHash ?? receipt2.hash, blockNumber: receipt2.blockNumber, status: receipt2.status },
         };
      } catch (err) {
         throw new InternalServerErrorException('Token transfer failed');
      }
   }

   async stakeTokensFromUser(encryptedPrivateKey: string, amountTokens: string, poolId: number, gasLimit?: bigint) { //gasLimit should be removed in future
      const wallet = await this.createSignerFromEncryptedKey(encryptedPrivateKey);

      // --- Load token contract ---
      const tokenAddress = this.contractAddresses.LOT_TOKEN;
      const tokenAbi = this.contractAbis.LOT_TOKEN;
      const tokenContract = new Contract(tokenAddress, tokenAbi, wallet);

      // --- Load staking contract ---
      const stakingAddress = this.contractAddresses.LOT_STAKING;
      const stakingAbi = this.contractAbis.LOT_STAKING;
      const stakingContract = new Contract(stakingAddress, stakingAbi, wallet);

      // --- Prepare amounts ---
      const decimals: number = await tokenContract.decimals();
      const amountBN = ethers.parseUnits(amountTokens, decimals);

      // --- Check user balance ---
      const balance = await tokenContract.balanceOf(wallet.address);
      if (balance < amountBN) {
         throw new ConflictException(
            `Insufficient token balance. Wallet has ${ethers.formatUnits(
               balance,
               decimals
            )}`
         );
      }

      // const finalGasLimitApprove = gasLimit ?? 100_000n;
      // const finalGasLimitStake = gasLimit ?? 200_000n;

      // Dynamic gas estimation
      const approveGas = await this.estimateGasWithBuffer(tokenContract, 'approve', [this.contractAddresses.LOT_STAKING, amountBN]);
      const stakeGas = await this.estimateGasWithBuffer(stakingContract, 'stake', [amountBN, poolId]);

      // --- Gas estimation ---
      const feeData = await this.provider.getFeeData();
      if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
         throw new InternalServerErrorException("Provider did not return EIP-1559 gas data");
      }

      // Add pool validation before staking
      const poolInfo = await stakingContract.getPoolInfo(poolId);
      if (!poolInfo.active) {
         throw new Error('Staking pool is not active');
      }

      try {
         // Approve first and wait
         const approveTx = await tokenContract.approve(stakingAddress, amountBN, {
            gasLimit: approveGas,
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
         });
         await approveTx.wait(1);

         // Then stake
         const stakeTx = await stakingContract.stake(amountBN, poolId, {
            gasLimit: stakeGas,
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
         });
         const receipt = await stakeTx.wait(1);

         const stakedEvent = receipt.logs
            .map((log) => {
               try {
                  return stakingContract.interface.parseLog(log);
               } catch {
                  return null;
               }
            })
            .find((parsed) => parsed && parsed.name === 'Staked');

         const contractStakeId = stakedEvent?.args?.stakeId.toString();

         if (!stakedEvent) console.warn('Staked event not found in transaction receipt');

         return {
            approveTxHash: approveTx.hash,
            stakeTxHash: receipt.transactionHash ?? receipt.hash,
            blockNumber: receipt.blockNumber,
            status: receipt.status,
            contractStakeId: contractStakeId || 'unknown'
         };
      } catch (err) {
         throw new InternalServerErrorException('Staking transaction failed');
      }
   }

   /**
 * Get how many tokens a user has staked.
 */
   async getUserStakesStats(userAddress: string): Promise<UserStake[]> {
      try {
         const decimals = await this.TokenContract.decimals();
         const contractStakes = await this.StakingContract.getUserStakes(userAddress);

         return contractStakes.map((stake, index) => ({
            id: index,
            amount: ethers.formatUnits(stake.amount, decimals),
            poolId: stake.poolId.toString(),
            startTime: new Date(Number(stake.startTime) * 1000),
            endTime: new Date(Number(stake.endTime) * 1000),
            withdrawn: stake.withdrawn,
            poolInfo: STAKING_POOLS[stake.poolId]
         }));
      } catch (err) {
         throw new InternalServerErrorException('Failed to fetch user stakes');
      }
   }

   /**
    * Get pending (unclaimed) rewards for a user.
    */
   async getPendingRewards(userAddress: string, stakeId: number): Promise<{ raw: bigint; formatted: string }> {
      try {
         const stakingContract = new Contract(
            this.contractAddresses.LOT_STAKING,
            this.contractAbis.LOT_STAKING,
            this.provider,
         );

         const tokenContract = new Contract(
            this.contractAddresses.LOT_TOKEN,
            this.contractAbis.LOT_TOKEN,
            this.provider,
         );

         const decimals: number = await tokenContract.decimals();
         const pending: bigint = await stakingContract.calculatePendingRewards(userAddress, stakeId);

         return {
            raw: pending,
            formatted: ethers.formatUnits(pending, decimals),
         };
      } catch (err) {
         throw new InternalServerErrorException('Failed to fetch pending rewards');
      }
   }

   /**
    * Claim rewards for the user.
    */
   async claimRewards(encryptedPrivateKey: string, stakeId: number, gasLimit?: bigint): Promise<{ txHash: string; status: number; blockNumber: number }> {
      const wallet = await this.createSignerFromEncryptedKey(encryptedPrivateKey);

      const stakingContract = new Contract(
         this.contractAddresses.LOT_STAKING,
         this.contractAbis.LOT_STAKING,
         wallet,
      );

      const feeData = await this.provider.getFeeData();
      if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
         throw new InternalServerErrorException('Provider did not return EIP-1559 gas data');
      }

      try {
         const tx = await stakingContract.claimRewards(stakeId, {
            gasLimit: gasLimit ?? 100_000n,
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
         });
         const receipt = await tx.wait(1);

         return { txHash: receipt.hash, status: receipt.status, blockNumber: receipt.blockNumber };
      } catch (err) {
         throw new InternalServerErrorException('Failed to claim rewards');
      }
   }

   /**
    * Unstake tokens.
    */
   async unstakeTokens(
      encryptedPrivateKey: string,
      stakeId: number,
      gasLimit?: bigint,
   ): Promise<{ txHash: string; status: number; blockNumber: number }> {
      const privateKey = this.aesDecrypt(encryptedPrivateKey);
      const wallet = new ethers.Wallet(privateKey, this.provider);
      const stakingContract = new Contract(
         this.contractAddresses.LOT_STAKING,
         this.contractAbis.LOT_STAKING,
         wallet // ✅ Use wallet (signer) instead
      );

      // const decimals: number = await tokenContract.decimals();
      // const amountBN = ethers.parseUnits(amountTokens, decimals);

      const feeData = await this.provider.getFeeData();
      if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
         throw new InternalServerErrorException('Provider did not return EIP-1559 gas data');
      }

      try {
         const tx = await stakingContract.unstake(stakeId, {
            gasLimit: gasLimit ?? 200_000n,
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
         });
         const receipt = await tx.wait(1);

         return { txHash: receipt.hash, status: receipt.status, blockNumber: receipt.blockNumber };
      } catch (err) {
         throw new InternalServerErrorException('Failed to unstake tokens');
      }
   }

   /**
    * Get general staking contract stats.
    */
   async getContractStats() {
      try {
         const decimals: number = await this.TokenContract.decimals();

         const totalStaked: bigint = await this.StakingContract.totalStaked();
         const stats = await this.StakingContract.getContractStats();
         return {
            totalStaked: ethers.formatUnits(stats.totalStaked_, decimals),
            totalRewardsDistributed: ethers.formatUnits(stats.totalRewardsDistributed_, decimals),
            totalFeesBurned: ethers.formatUnits(stats.totalFeesBurned_, decimals),
            contractBalance: ethers.formatEther(stats.contractBalance)
            // ... other stats
         };
      } catch (err) {
         throw new InternalServerErrorException('Failed to fetch staking contract stats');
      }
   }
}
