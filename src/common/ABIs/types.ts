

import { ethers } from 'ethers';

// Contract Address Types
export interface ContractAddresses {
  LOT_TOKEN: string;
  LOT_STAKING: string;
  REWARD: string;
}

// Network Configuration Types
export interface NetworkConfig {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  currency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

// Staking Pool Types
export interface StakingPool {
  id: number;
  name: string;
  duration: string;
  apy: number;
  durationSeconds: number;
}

// User Stake Types
export interface UserStake {
  id: number;
  amount: string;
  poolId: string;
  startTime: Date;
  endTime: Date;
  withdrawn: boolean;
  poolInfo: StakingPool;
}

// Fee Configuration Types
export interface FeeConfig {
  ENTRY_FEE: number;
  EXIT_FEE: number;
  EARLY_EXIT_PENALTY: number;
  REWARD_CLAIM_TAX: number;
  BURN_PERCENTAGE: number;
  REWARD_POOL_PERCENTAGE: number;
  TREASURY_PERCENTAGE: number;
}

// Token Configuration Types
export interface TokenConfig {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
}

// Contract Stats Types
export interface ContractStats {
  totalStaked: string;
  totalRewards: string;
  totalBurned: string;
  contractBalance: string;
}

// User Balances Types
export interface UserBalances {
  eth: string;
  lot: string;
}

// Transaction Result Types
export interface TransactionResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

// Contract Interaction Hook Types
export interface UseLoteraaDePINReturn {
  // State
  account: string;
  balances: UserBalances;
  contracts: {
    lotToken?: ethers.Contract;
    lotStaking?: ethers.Contract;
  };
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  
  // Functions
  connectWallet: () => Promise<{ success: boolean; address?: string; error?: string }>;
  stakeTokens: (amount: number, poolId: number) => Promise<TransactionResult>;
  getUserStakes: () => Promise<UserStake[]>;
  getPendingRewards: (stakeId: number) => Promise<string>;
  claimRewards: (stakeId: number) => Promise<TransactionResult>;
  unstakeTokens: (stakeId: number) => Promise<TransactionResult>;
  getContractStats: () => Promise<ContractStats>;
  
  // Config
  STAKING_POOLS: StakingPool[];
  FEE_CONFIG: FeeConfig;
}

// Event Types (for contract event listening)
export interface StakeEvent {
  user: string;
  amount: string;
  poolId: number;
  stakeId: number;
  timestamp: number;
}

export interface UnstakeEvent {
  user: string;
  stakeId: number;
  amount: string;
  reward: string;
  timestamp: number;
}

export interface RewardClaimEvent {
  user: string;
  stakeId: number;
  reward: string;
  tax: string;
  timestamp: number;
}

// Configuration Constants with Types
export const CONTRACT_ADDRESSES: ContractAddresses = {
  LOT_TOKEN: "0x115b621cA7eAD65198Dd8BB14f788f1695c74CF7",
  LOT_STAKING: "0x6ba42e11d89f1ca570a9e6ae5cb61d2d7e8740e3",
  REWARD: '0x515f7509F391acbd5B536B658006fAa5f36B0AEF'
};

export const NETWORK_CONFIG: NetworkConfig = {
  chainId: 31337,
  chainName: 'Loteraa Local',
  rpcUrl: 'http://127.0.0.1:8545',
  currency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18
  }
};

export const STAKING_POOLS: StakingPool[] = [
  {
    id: 0,
    name: "4 Week Pool",
    duration: "4 weeks",
    apy: 12.5,
    durationSeconds: 4 * 7 * 24 * 60 * 60
  },
  {
    id: 1,
    name: "8 Week Pool", 
    duration: "8 weeks",
    apy: 16.8,
    durationSeconds: 8 * 7 * 24 * 60 * 60
  },
  {
    id: 2,
    name: "12 Week Pool",
    duration: "12 weeks", 
    apy: 21.3,
    durationSeconds: 12 * 7 * 24 * 60 * 60
  },
  {
    id: 3,
    name: "4 Month Pool",
    duration: "4 months",
    apy: 27.5,
    durationSeconds: 4 * 30 * 24 * 60 * 60
  }
];

export const FEE_CONFIG: FeeConfig = {
  ENTRY_FEE: 3,
  EXIT_FEE: 4,
  EARLY_EXIT_PENALTY: 7,
  REWARD_CLAIM_TAX: 3,
  BURN_PERCENTAGE: 30,
  REWARD_POOL_PERCENTAGE: 50,
  TREASURY_PERCENTAGE: 20
};
