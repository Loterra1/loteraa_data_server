// Loteraa DePIN Platform - Frontend Integration Example
// How to use the contracts in React/Next.js

import { ethers } from 'ethers';
import {
  NETWORK_CONFIG,
  CONTRACT_ADDRESSES,
  CONTRACT_ABIS,
  STAKING_POOLS,
  FEE_CONFIG
} from './contracts.js';

// Example React Hook for Contract Integration
export const useLoteraaDePIN = () => {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contracts, setContracts] = useState({});
  const [account, setAccount] = useState('');
  const [balances, setBalances] = useState({ eth: '0', lot: '0' });

  // Connect to MetaMask
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask not installed');
      }

      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Set up provider and signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

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

      setProvider(provider);
      setSigner(signer);
      setAccount(address);
      setContracts({ lotToken, lotStaking });

      // Load balances
      await loadBalances(address, provider, lotToken);

      return { success: true, address };
    } catch (error) {
      console.error('Connection failed:', error);
      return { success: false, error: error.message };
    }
  };

  // Load user balances
  const loadBalances = async (address, provider, lotToken) => {
    try {
      const ethBalance = await provider.getBalance(address);
      const lotBalance = await lotToken.balanceOf(address);

      setBalances({
        eth: ethers.formatEther(ethBalance),
        lot: ethers.formatEther(lotBalance)
      });
    } catch (error) {
      console.error('Failed to load balances:', error);
    }
  };

  // Stake tokens
  const stakeTokens = async (amount, poolId) => {
    try {
      if (!contracts.lotToken || !contracts.lotStaking) {
        throw new Error('Contracts not initialized');
      }

      const stakeAmount = ethers.parseEther(amount.toString());

      // First approve tokens
      console.log('Approving tokens...');
      const approveTx = await contracts.lotToken.approve(
        CONTRACT_ADDRESSES.LOT_STAKING,
        stakeAmount
      );
      await approveTx.wait();

      // Then stake
      console.log('Staking tokens...');
      const stakeTx = await contracts.lotStaking.stake(stakeAmount, poolId);
      await stakeTx.wait();

      // Reload balances
      await loadBalances(account, provider, contracts.lotToken);

      return { success: true, txHash: stakeTx.hash };
    } catch (error) {
      console.error('Staking failed:', error);
      return { success: false, error: error.message };
    }
  };

  // Get user stakes
  const getUserStakes = async () => {
    try {
      if (!contracts.lotStaking || !account) return [];

      const stakes = await contracts.lotStaking.getUserStakes(account);
      
      // Format stakes with additional info
      const formattedStakes = stakes.map((stake, index) => ({
        id: index,
        amount: ethers.formatEther(stake.amount),
        poolId: stake.poolId.toString(),
        startTime: new Date(Number(stake.startTime) * 1000),
        endTime: new Date(Number(stake.endTime) * 1000),
        withdrawn: stake.withdrawn,
        poolInfo: STAKING_POOLS[stake.poolId]
      }));

      return formattedStakes;
    } catch (error) {
      console.error('Failed to get user stakes:', error);
      return [];
    }
  };

  // Calculate pending rewards
  const getPendingRewards = async (stakeId) => {
    try {
      if (!contracts.lotStaking || !account) return '0';

      const rewards = await contracts.lotStaking.calculatePendingRewards(account, stakeId);
      return ethers.formatEther(rewards);
    } catch (error) {
      console.error('Failed to get pending rewards:', error);
      return '0';
    }
  };

  // Claim rewards
  const claimRewards = async (stakeId) => {
    try {
      if (!contracts.lotStaking) {
        throw new Error('Staking contract not initialized');
      }

      const claimTx = await contracts.lotStaking.claimRewards(stakeId);
      await claimTx.wait();

      // Reload balances
      await loadBalances(account, provider, contracts.lotToken);

      return { success: true, txHash: claimTx.hash };
    } catch (error) {
      console.error('Claim rewards failed:', error);
      return { success: false, error: error.message };
    }
  };

  // Unstake tokens
  const unstakeTokens = async (stakeId) => {
    try {
      if (!contracts.lotStaking) {
        throw new Error('Staking contract not initialized');
      }

      const unstakeTx = await contracts.lotStaking.unstake(stakeId);
      await unstakeTx.wait();

      // Reload balances
      await loadBalances(account, provider, contracts.lotToken);

      return { success: true, txHash: unstakeTx.hash };
    } catch (error) {
      console.error('Unstaking failed:', error);
      return { success: false, error: error.message };
    }
  };

  // Get contract statistics
  const getContractStats = async () => {
    try {
      if (!contracts.lotStaking) return {};

      const stats = await contracts.lotStaking.getContractStats();
      
      return {
        totalStaked: ethers.formatEther(stats.totalStaked_),
        totalRewards: ethers.formatEther(stats.totalRewardsDistributed_),
        totalBurned: ethers.formatEther(stats.totalFeesBurned_),
        contractBalance: ethers.formatEther(stats.contractBalance)
      };
    } catch (error) {
      console.error('Failed to get contract stats:', error);
      return {};
    }
  };

  return {
    // State
    account,
    balances,
    contracts,
    provider,
    signer,
    
    // Functions
    connectWallet,
    stakeTokens,
    getUserStakes,
    getPendingRewards,
    claimRewards,
    unstakeTokens,
    getContractStats,
    
    // Config
    STAKING_POOLS,
    FEE_CONFIG
  };
};

// Example React Component
export const StakingDashboard = () => {
  const {
    account,
    balances,
    connectWallet,
    stakeTokens,
    getUserStakes,
    STAKING_POOLS
  } = useLoteraaDePIN();

  const [stakes, setStakes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (account) {
      loadUserStakes();
    }
  }, [account]);

  const loadUserStakes = async () => {
    setLoading(true);
    const userStakes = await getUserStakes();
    setStakes(userStakes);
    setLoading(false);
  };

  const handleStake = async (amount, poolId) => {
    setLoading(true);
    const result = await stakeTokens(amount, poolId);
    if (result.success) {
      await loadUserStakes();
      alert('Staking successful!');
    } else {
      alert('Staking failed: ' + result.error);
    }
    setLoading(false);
  };

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-3xl font-bold mb-8">Loteraa DePIN Platform</h1>
        <button
          onClick={connectWallet}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4">Account Info</h2>
        <p>Address: {account}</p>
        <p>ETH Balance: {parseFloat(balances.eth).toFixed(4)} ETH</p>
        <p>LOT Balance: {parseFloat(balances.lot).toLocaleString()} LOT</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {STAKING_POOLS.map((pool) => (
          <div key={pool.id} className="bg-white shadow-lg rounded-lg p-4">
            <h3 className="font-bold text-lg">{pool.name}</h3>
            <p className="text-gray-600">{pool.duration}</p>
            <p className="text-green-600 font-bold">{pool.apy}% APY</p>
            <button
              onClick={() => handleStake(10000, pool.id)}
              disabled={loading}
              className="mt-2 bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-3 rounded text-sm"
            >
              Stake 10K LOT
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white shadow-lg rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Your Stakes</h2>
        {loading ? (
          <p>Loading...</p>
        ) : stakes.length === 0 ? (
          <p>No active stakes found.</p>
        ) : (
          <div className="space-y-4">
            {stakes.map((stake) => (
              <div key={stake.id} className="border rounded p-4">
                <p><strong>Amount:</strong> {parseFloat(stake.amount).toLocaleString()} LOT</p>
                <p><strong>Pool:</strong> {stake.poolInfo.name} ({stake.poolInfo.apy}% APY)</p>
                <p><strong>Start:</strong> {stake.startTime.toLocaleDateString()}</p>
                <p><strong>End:</strong> {stake.endTime.toLocaleDateString()}</p>
                <p><strong>Status:</strong> {stake.withdrawn ? 'Withdrawn' : 'Active'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StakingDashboard;
