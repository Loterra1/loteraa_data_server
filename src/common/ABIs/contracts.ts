// Loteraa DePIN Platform - TypeScript Configuration
// For TypeScript frontend projects

import LOTTokenABI from './LotTokenABI.json';
import LOTStakingABI from './LOTStaking.json';
import RewardABI from './Reward.json'
import type { 
  ContractAddresses, 
  NetworkConfig, 
  StakingPool, 
  FeeConfig 
} from './types';

// Contract Addresses (Local Network)
export const CONTRACT_ADDRESSES: ContractAddresses = {
  LOT_TOKEN: "0x115b621cA7eAD65198Dd8BB14f788f1695c74CF7", //mainnet
  LOT_STAKING: "0x6bA42E11D89f1cA570A9E6AE5cb61D2D7E8740e3", //mainnet
  REWARD: '0x515f7509F391acbd5B536B658006fAa5f36B0AEF' // mainnet
};

// Network Configuration
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

// Contract ABIs (Imported from JSON files)
export const CONTRACT_ABIS = {
  LOT_TOKEN: LOTTokenABI,
  LOT_STAKING: LOTStakingABI,
  REWARD_ABI: RewardABI
} as const;

// Staking Pool Configuration
export const STAKING_POOLS: StakingPool[] = [
  {
    id: 0,
    name: "4 Week Pool",
    duration: "4 weeks",
    apy: 12.5,
    durationSeconds: 4 * 7 * 24 * 60 * 60  // 2,419,200 seconds
  },
  {
    id: 1,
    name: "8 Week Pool", 
    duration: "8 weeks",
    apy: 16.8,
    durationSeconds: 8 * 7 * 24 * 60 * 60  // 4,838,400 seconds
  },
  {
    id: 2,
    name: "12 Week Pool",
    duration: "12 weeks", 
    apy: 21.3,
    durationSeconds: 12 * 7 * 24 * 60 * 60  // 7,257,600 seconds
  },
  {
    id: 3,
    name: "4 Month Pool",
    duration: "4 months",
    apy: 27.5,
    durationSeconds: 4 * 30 * 24 * 60 * 60  // 10,368,000 seconds (approximate)
  }
];

// Fee Configuration (percentages)
export const FEE_CONFIG: FeeConfig = {
  ENTRY_FEE: 3,              // 3% when staking
  EXIT_FEE: 4,               // 4% when unstaking (normal)
  EARLY_EXIT_PENALTY: 7,     // 7% when unstaking early
  REWARD_CLAIM_TAX: 3,       // 3% when claiming rewards
  BURN_PERCENTAGE: 30,       // 30% of fees are burned
  REWARD_POOL_PERCENTAGE: 50, // 50% of fees go to reward pool
  TREASURY_PERCENTAGE: 20    // 20% of fees go to treasury
};

// Token Configuration
export const TOKEN_CONFIG = {
  name: "Loteraa Token",
  symbol: "LOT",
  decimals: 18,
  totalSupply: "300000000" // 300 million tokens
} as const;

// MetaMask Network Addition Helper
export const METAMASK_NETWORK = {
  chainId: `0x${NETWORK_CONFIG.chainId.toString(16)}`, // 0x7a69
  chainName: NETWORK_CONFIG.chainName,
  nativeCurrency: NETWORK_CONFIG.currency,
  rpcUrls: [NETWORK_CONFIG.rpcUrl],
  blockExplorerUrls: null // No block explorer for local network
} as const;

// Utility Functions with Types
export const formatLOTAmount = (amount: string): string => {
  const formatted = parseFloat(amount);
  return formatted.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4
  });
};

export const calculateFee = (amount: number, feePercentage: number): number => {
  return (amount * feePercentage) / 100;
};

export const getPoolById = (poolId: number): StakingPool | undefined => {
  return STAKING_POOLS.find(pool => pool.id === poolId);
};

// Export everything for easy importing
export default {
  CONTRACT_ADDRESSES,
  CONTRACT_ABIS,
  NETWORK_CONFIG,
  STAKING_POOLS,
  FEE_CONFIG,
  TOKEN_CONFIG,
  METAMASK_NETWORK,
  formatLOTAmount,
  calculateFee,
  getPoolById
};
