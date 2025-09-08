import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ethers, JsonRpcProvider, formatEther, HDNodeWallet, parseEther, TransactionRequest, Contract } from 'ethers';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { CONTRACT_ABIS, CONTRACT_ADDRESSES } from '../../ABIs/contracts'


@Injectable()
export class WalletSystemService {
   private provider: JsonRpcProvider
   private readonly MASTER_MNEMONIC: string;
   private readonly MASTER_ENCRYPTION_KEY: string;
   private readonly MASTER_ADDRESS: string
   private readonly ETHEREUM_RPC: string;
   private readonly contractAddresses: typeof CONTRACT_ADDRESSES;
   private readonly contractAbis: typeof CONTRACT_ABIS;


   constructor(private config: ConfigService) {
      this.MASTER_MNEMONIC = this.config.get<string>('MASTER_MNEMONIC')!;
      this.MASTER_ENCRYPTION_KEY = this.config.get<string>('MASTER_ENCRYPTION_KEY')!;
      this.MASTER_ADDRESS = this.config.get<string>('MASTER_ADDRESS')!;
      this.ETHEREUM_RPC = this.config.get<string>('INFURA_ETHEREUM_RPC_URL')!;
      this.provider = new JsonRpcProvider(this.ETHEREUM_RPC);
      this.contractAddresses = CONTRACT_ADDRESSES
      this.contractAbis = CONTRACT_ABIS
   }

   public aesEncrypt(plaintext: string) { //returns hex string
      const key = Buffer.from(this.MASTER_ENCRYPTION_KEY, 'hex');
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      return Buffer.concat([iv, tag, encrypted]).toString('hex');
   }

   private aesDecrypt(cipherHex: string) { //decrypts hex string
      const key = Buffer.from(this.MASTER_ENCRYPTION_KEY, 'hex');
      const data = Buffer.from(cipherHex, 'hex');
      const iv = data.slice(0, 12);
      const tag = data.slice(12, 28);
      const encrypted = data.slice(28);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted.toString('utf8');
   }

   private decryptPrivateKey(encryptedHex: string) {
      return this.aesDecrypt(encryptedHex);
   }

   private _getNextIndex(userId: string): number {
      const hash = crypto.createHash('sha256').update(userId).digest('hex');
      return parseInt(hash.substring(0, 8), 16);
   }

   async getBalance(address: string) {
      const tokenContract = new Contract(this.contractAddresses.LOT_TOKEN, this.contractAbis.LOT_TOKEN, this.provider);
      const balance = await tokenContract.balanceOf(address);
      const decimals: number = await tokenContract.decimals();
      return { etherFormatted: ethers.formatUnits(balance, decimals), raw: balance.toString() };
   }

   async createUserWallet(userId: string) {
      const index = this._getNextIndex(userId);
      const root = HDNodeWallet.fromPhrase(this.MASTER_MNEMONIC);
      const child = root.derivePath(`m/44'/60'/0'/0/${index}`);

      // Create Wallet (signer) connected to provider
      const wallet = new ethers.Wallet(child.privateKey, this.provider);

      return wallet
   }

   async sendEthFromUser(encryptedPrivateKey: string, to: string, amountTokens: string, gasLimit?: bigint) {
      const privateKey = this.decryptPrivateKey(encryptedPrivateKey);
      const wallet = new ethers.Wallet(privateKey, this.provider);

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
      // const txRequest: TransactionRequest = {
      //    to,
      //    value: netAmountBN,
      //    gasLimit: gasLimit ?? 21000,
      //    maxFeePerGas: feeData.maxFeePerGas,
      //    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      // };


      // 1. Transfer net tokens to recipient
      const txResponse = await tokenContract.transfer(to, netAmountBN, {
         gasLimit: gasLimit ?? 100000n, // ERC20 transfers need more than 21000
         maxFeePerGas: feeData.maxFeePerGas,
         maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      });

      // // your MASTER_WALLET fees estimation
      // const masterTxRequest: TransactionRequest = {
      //    to: process.env.MASTER_ADDRESS,
      //    value: feeBN,
      //    maxFeePerGas: feeData.maxFeePerGas!,
      //    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas!,
      // };

      // 2. Transfer fee tokens to master wallet
      const masterResponse = await tokenContract.transfer(
         this.MASTER_ADDRESS,
         feeBN,
         {
            gasLimit: gasLimit ?? 100000n,
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
         }
      );

      // send & wait for confirmation
      // const txResponse = await wallet.sendTransaction(txRequest);
      // const masterResponse = await wallet.sendTransaction(masterTxRequest)
      // const receipt = await Promise.all([
      //    txResponse.wait(1),
      //    masterResponse.wait(1),
      // ]); // wait for 1 confirmation

      // return receipt;

      // Wait for confirmations
      const [receipt, feeReceipt] = await Promise.all([
         txResponse.wait(1),
         masterResponse.wait(1),
      ]);

      return {
         userTx: {
            hash: receipt.hash,
            blockNumber: receipt.blockNumber,
            status: receipt.status,
         },
         feeTx: {
            hash: feeReceipt.hash,
            blockNumber: feeReceipt.blockNumber,
            status: feeReceipt.status,
         },
      };
   }

   async stakeTokensFromUser(encryptedPrivateKey: string, amountTokens: string, gasLimit?: bigint) {
      const privateKey = this.decryptPrivateKey(encryptedPrivateKey);
      const wallet = new ethers.Wallet(privateKey, this.provider);

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
         throw new Error(
            `Insufficient token balance. Wallet has ${ethers.formatUnits(
               balance,
               decimals
            )}`
         );
      }

      // --- Gas estimation ---
      const feeData = await this.provider.getFeeData();
      if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
         throw new Error("Provider did not return EIP-1559 gas data");
      }

      // --- Step 1: Approve staking contract ---
      const approveTx = await tokenContract.approve(stakingAddress, amountBN, {
         gasLimit: gasLimit ?? 100000n,
         maxFeePerGas: feeData.maxFeePerGas,
         maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      });
      await approveTx.wait(1);
      console.log(`Approved ${stakingAddress} to spend tokens`);

      // --- Step 2: Call stake() ---
      const stakeTx = await stakingContract.stake(amountBN, {
         gasLimit: gasLimit ?? 200000n, // staking calls often need more gas
         maxFeePerGas: feeData.maxFeePerGas,
         maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      });
      const receipt = await stakeTx.wait(1);

      return {
         approveTxHash: approveTx.hash,
         stakeTxHash: receipt.hash,
         blockNumber: receipt.blockNumber,
         status: receipt.status,
      };
   }



   // async createWallet() {
   //    // Generate random wallet
   //    const wallet = ethers.Wallet.createRandom();

   //    return {
   //       address: wallet.address,
   //       privateKey: wallet.privateKey,
   //       mnemonic: wallet.mnemonic?.phrase,
   //    };
   // }

}
