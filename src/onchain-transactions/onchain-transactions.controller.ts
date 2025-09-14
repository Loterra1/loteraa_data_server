import { Controller, Get, Post, Query, Body, ParseIntPipe } from '@nestjs/common';
import { OnchainTransactionsService } from './onchain-transactions.service';
import { SendEthDto, StakeTokensDto } from './dto/create-onchain-transaction.dto';

@Controller('onchain')
export class OnchainTransactionsController {
  constructor(private readonly onchainService: OnchainTransactionsService) { }

  /**
   * Create a new wallet
   */
  @Post('create-wallet')
  async createWallet(@Query('userId') userId: string) {
    return await this.onchainService.createUserWallet(userId);
  }

  /**
   * Create a new wallet
   */
  @Get('retrieve-wallet')
  async getUserWallet(@Query('userId') userId: string) {
    return await this.onchainService.getUserWallet(userId);
  }

  /**
   * Get user balance
   */
  @Get('balance')
  async getBalance(@Query('userId') userId: string) {
    return await this.onchainService.getUserBalance(userId);
  }

  /**
   * Get user Eth balance
   */
  @Get('eth-balance')
  async getEthBalance(@Query('userId') userId: string) {
    return await this.onchainService.getEthBalance(userId);
  }

  /**
   * Send tokens
   */
  @Post('send-tokens')
  async sendTokens(
    @Body() sendEthDto: SendEthDto
  ) {
    const { userId, address, amount } = sendEthDto
    return await this.onchainService.sendTokens(userId, address, String(amount));
  }

  /**
   * Stake tokens into a pool
   */
  @Post('stake-token')
  async stakeTokens(
    @Body() stakeTokenDto: StakeTokensDto
  ) {
    const { userId, poolId, amount } = stakeTokenDto
    return await this.onchainService.stakeTokens(userId, String(amount), poolId);
  }

  /**
   * Claim staking rewards
   */
  @Post('claim-rewards')
  async claimRewards(
    @Query('userId') userId: string,
    @Query('stakeId') stakeId: number,
  ) {
    return await this.onchainService.claimRewards(userId, stakeId);
  }

  /**
   * Unstake tokens
   */
  @Post('unstake')
  async unstakeTokens(
    @Query('userId') userId: string,
    @Query('stakeId') stakeId: number,
  ) {
    return await this.onchainService.unstakeTokens(userId, stakeId);
  }

  /**
   * Fetch pending rewards
   */
  @Get('pending-rewards')
  async getPendingRewards(
    @Query('userId') userId: string,
    @Query('stakeId') stakeId: number,
  ) {
    return await this.onchainService.getPendingRewards(userId, stakeId);
  }

  /**
   * Fetch user transactions
   */
  @Get('transactions')
  async getUserTransactions(
    @Query('userId') userId: string,
    @Query('limit', ParseIntPipe) limit: number,
    @Query('page', ParseIntPipe) page: number,
  ) {
    return await this.onchainService.getUserTransactions(userId, limit ?? 50, page ?? 1);
  }

  /**
   * Fetch user stakes
   */
  @Get('stakes')
  async getUserStakes(
    @Query('userId') userId: string,
    @Query('limit', ParseIntPipe) limit: number,
    @Query('page', ParseIntPipe) page: number,
  ) {
    return await this.onchainService.getUserStakes(userId, limit ?? 50, page ?? 1);
  }

  /**
   * Fetch user stakes stats
   */
  @Get('user-stakes-stats')
  async getUserStakesStats(@Query('userId') userId: string) {
    return await this.onchainService.getUserStakesStats(userId);
  }

  /**
    * Get general staking contract stats
    */
  @Get('general-staking-stats')
  async getStakingStats() {
    return await this.onchainService.getStakingStats()
  }
}

