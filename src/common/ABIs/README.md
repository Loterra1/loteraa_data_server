# Loteraa DePIN Platform - Frontend Integration

This directory contains everything needed to integrate the Loteraa DePIN smart contracts with your frontend.

## Files Overview

```bash
├── LOTToken.json          # LOT Token contract ABI (41 functions)
├── LOTStaking.json        # LOT Staking contract ABI (54 functions)  
├── contracts.js           # Complete configuration & ABIs
├── frontend-example.js    # React integration examples
└── README.md             # This file
```

## Quick Start

### 1. Install Dependencies
```bash
npm install ethers
```

### 2. Import Configuration
```javascript
import {
  NETWORK_CONFIG,
  CONTRACT_ADDRESSES,
  CONTRACT_ABIS,
  STAKING_POOLS,
  FEE_CONFIG
} from './contracts.js';
```

### 3. Connect to Contracts
```javascript
import { ethers } from 'ethers';

// Connect to MetaMask
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

// Initialize contracts
const lotToken = new ethers.Contract(
  CONTRACT_ADDRESSES.LOT_TOKEN,
  CONTRACT_ABIS.LOT_TOKEN,
  signer
);

const lotStaking = new ethers.Contract(
  CONTRACT_ADDRESSES.LOT_STAKING,
  CONTRACT_ABIS.LOT_STAKING,
  signer
);
```

## Network Setup

### MetaMask Configuration
```bash
Network Name: Loteraa Local
RPC URL: http://127.0.0.1:8545
Chain ID: 31337
Currency: ETH
```

### Import Test Account
```bash
Private Key: ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### Add LOT Token
```bash
Contract Address: 0x5FbDB2315678afecb367f032d93F642f64180aa3
Symbol: LOT
Decimals: 18
```

## Core Functions

### LOT Token Functions
```javascript
// Check balance
const balance = await lotToken.balanceOf(userAddress);

// Transfer tokens
await lotToken.transfer(toAddress, amount);

// Approve spending
await lotToken.approve(spenderAddress, amount);
```

### LOT Staking Functions
```javascript
// Stake tokens
await lotStaking.stake(amount, poolId);

// Get user stakes
const stakes = await lotStaking.getUserStakes(userAddress);

// Calculate pending rewards
const rewards = await lotStaking.calculatePendingRewards(userAddress, stakeId);

// Claim rewards
await lotStaking.claimRewards(stakeId);

// Unstake
await lotStaking.unstake(stakeId);
```

## Staking Pools

```javascript
const pools = [
  { id: 0, duration: "4 weeks", apy: 12.5 },
  { id: 1, duration: "8 weeks", apy: 16.8 },
  { id: 2, duration: "12 weeks", apy: 21.3 },
  { id: 3, duration: "4 months", apy: 27.5 }
];
```

## Fee Structure

```javascript
const fees = {
  entryFee: 3,        // 3% when staking
  exitFee: 4,         // 4% when unstaking (after maturity)
  earlyExitPenalty: 7, // 7% when unstaking early
  rewardClaimTax: 3   // 3% when claiming rewards
};
```

## Testing Data

### Available Balances
```bash
Account 0: 289,000,000 LOT + 9,999 ETH
Account 1: 1,000,000 LOT + 10,000 ETH
```

### Test Scenarios
```javascript
// Small stake
await stakeTokens("1000", 0);

// Medium stake  
await stakeTokens("10000", 1);

// Large stake
await stakeTokens("100000", 2);
```


