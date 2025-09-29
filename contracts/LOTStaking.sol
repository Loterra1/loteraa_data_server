// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./ILOTToken.sol";

/**
 * @title LOTStaking
 * @dev Loteraa Staking Contract with Proof of Yield (PoY) Mechanism
 * @notice Handles multi-pool staking with different durations and APYs
 * 
 * Staking Pools:
 * - 4 Weeks: 3% APY
 * - 8 Weeks: 5% APY  
 * - 12 Weeks: 7% APY
 * - 4 Months: 9% APY
 * 
 * Fee Structure:
 * - Entry fee: 3% of staked amount
 * - Exit fee: 4% if unstake after maturity, 7% if early unstake
 * - Reward claim tax: 3%
 * 
 * Burn Mechanism:
 * - 30% of fees burned
 * - 50% to reward pool
 * - 20% to treasury
 */
contract LOTStaking is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    ILOTToken public constant lotToken = ILOTToken(0x115b621cA7eAD65198Dd8BB14f788f1695c74CF7);
    
    // Pool configurations
    struct PoolConfig {
        uint256 duration;        // Duration in seconds
        uint256 apy;            // APY in basis points (10000 = 100%)
        uint256 totalStaked;    // Total amount staked in this pool
        bool active;            // Pool status
    }
    
    // Staking info for each user
    struct StakeInfo {
        uint256 amount;         // Amount staked (after entry fee)
        uint256 poolId;         // Pool ID
        uint256 startTime;      // Stake start timestamp
        uint256 endTime;        // Stake end timestamp
        uint256 lastClaimTime;  // Last reward claim timestamp
        uint256 rewardsClaimed; // Total rewards claimed
        bool withdrawn;         // Whether stake was withdrawn
    }
    
    // Proof of Yield tracking
    struct YieldSource {
        string name;            // Source name
        uint256 amount;         // Amount contributed
        uint256 timestamp;      // When added
    }

    // Pool configurations
    mapping(uint256 => PoolConfig) public pools;
    uint256 public poolCount;
    
    // User staking data
    mapping(address => StakeInfo[]) public userStakes;
    mapping(address => uint256) public userStakeCount;
    
    // Yield tracking for PoY
    YieldSource[] public yieldSources;
    uint256 public totalYieldGenerated;
    
    // Fee configuration (in basis points, 10000 = 100%)
    uint256 public constant ENTRY_FEE = 300;        // 3%
    uint256 public constant EXIT_FEE = 400;         // 4%
    uint256 public constant EARLY_EXIT_PENALTY = 700; // 7%
    uint256 public constant REWARD_CLAIM_TAX = 300; // 3%
    uint256 public constant EMERGENCY_WITHDRAWAL_FEE = 1200; // 12%   
    
    // Fee distribution (in basis points)
    uint256 public constant BURN_PERCENTAGE = 3000;     // 30%
    uint256 public constant REWARD_POOL_PERCENTAGE = 5000; // 50%
    uint256 public constant TREASURY_PERCENTAGE = 2000;   // 20%
    
    // Contract addresses
    address public treasury;
    address public rewardPool;
    
    // Stats
    uint256 public totalStaked;
    uint256 public totalRewardsDistributed;
    uint256 public totalFeesBurned;
    uint256 public totalFeesCollected;
    
    // Events
    event Staked(address indexed user, uint256 indexed stakeId, uint256 poolId, uint256 amount, uint256 afterFee);
    event Unstaked(address indexed user, uint256 indexed stakeId, uint256 amount, uint256 fee);
    event RewardsClaimed(address indexed user, uint256 indexed stakeId, uint256 reward, uint256 tax);
    event PoolCreated(uint256 indexed poolId, uint256 duration, uint256 apy);
    event PoolStatusChanged(uint256 indexed poolId, bool active);
    event YieldSourceAdded(string name, uint256 amount);
    event FeesDistributed(uint256 burned, uint256 toRewardPool, uint256 toTreasury);
    event EmergencyWithdrawal(address indexed user, uint256 amount);

    constructor(
        address _treasury,
        address _rewardPool
    ) Ownable(msg.sender){
        require(_treasury != address(0), "Invalid treasury address");
        require(_rewardPool != address(0), "Invalid reward pool address");
        
        treasury = _treasury;
        rewardPool = _rewardPool;
        
        // Initialize default pools
        _createDefaultPools();
    }

    /**
     * @dev Create default staking pools
     */
    function _createDefaultPools() internal {
        // 4 Weeks - 3% APY
        pools[0] = PoolConfig({
            duration: 4 * 7 * 24 * 60 * 60, // 4 weeks in seconds
            apy: 300, // 3% in basis points
            totalStaked: 0,
            active: true
        });
        
        // 8 Weeks - 5% APY
        pools[1] = PoolConfig({
            duration: 8 * 7 * 24 * 60 * 60, // 8 weeks in seconds
            apy: 500, // 5% in basis points
            totalStaked: 0,
            active: true
        });
        
        // 12 Weeks - 7% APY
        pools[2] = PoolConfig({
            duration: 12 * 7 * 24 * 60 * 60, // 12 weeks in seconds
            apy: 700, // 7% in basis points
            totalStaked: 0,
            active: true
        });
        
        // 4 Months - 9% APY
        pools[3] = PoolConfig({
            duration: 4 * 30 * 24 * 60 * 60, // ~4 months in seconds
            apy: 900, // 9% in basis points
            totalStaked: 0,
            active: true
        });
        
        poolCount = 4;
        
        for (uint256 i = 0; i < poolCount; i++) {
            emit PoolCreated(i, pools[i].duration, pools[i].apy);
        }
    }

    /**
     * @dev Stake tokens in a specific pool
     * @param amount Amount of tokens to stake
     * @param poolId Pool to stake in
     */
    function stake(uint256 amount, uint256 poolId) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(poolId < poolCount, "Invalid pool ID");
        require(pools[poolId].active, "Pool is not active");
        
        PoolConfig storage pool = pools[poolId];
        
        // Calculate entry fee
        uint256 entryFee = (amount * ENTRY_FEE) / 10000;
        uint256 stakeAmount = amount - entryFee;
        
        require(stakeAmount > 0, "Stake amount too small");
        
        // Transfer tokens from user
        IERC20(address(lotToken)).safeTransferFrom(msg.sender, address(this), amount);
        
        // Process entry fee
        _distributeFees(entryFee, "Entry Fee");
        
        // Create stake record
        uint256 stakeId = userStakeCount[msg.sender];
        userStakes[msg.sender].push(StakeInfo({
            amount: stakeAmount,
            poolId: poolId,
            startTime: block.timestamp,
            endTime: block.timestamp + pool.duration,
            lastClaimTime: block.timestamp,
            rewardsClaimed: 0,
            withdrawn: false
        }));
        
        userStakeCount[msg.sender]++;
        pool.totalStaked += stakeAmount;
        totalStaked += stakeAmount;
        
        emit Staked(msg.sender, stakeId, poolId, amount, stakeAmount);
    }

    /**
     * @dev Unstake tokens from a specific stake
     * @param stakeId Stake ID to unstake
     */
    function unstake(uint256 stakeId) external nonReentrant {
        require(stakeId < userStakeCount[msg.sender], "Invalid stake ID");
        
        StakeInfo storage stakeInfo = userStakes[msg.sender][stakeId];
        require(!stakeInfo.withdrawn, "Already withdrawn");
        require(stakeInfo.amount > 0, "No stake found");
        
        // Calculate pending rewards
        uint256 pendingRewards = calculatePendingRewards(msg.sender, stakeId);
        
        // Determine if early withdrawal
        bool isEarly = block.timestamp < stakeInfo.endTime;
        uint256 exitFee;
        
        if (isEarly) {
            exitFee = (stakeInfo.amount * EARLY_EXIT_PENALTY) / 10000;
        } else {
            exitFee = (stakeInfo.amount * EXIT_FEE) / 10000;
        }
        
        uint256 withdrawAmount = stakeInfo.amount - exitFee;
        

        
        // Mark as withdrawn
        stakeInfo.withdrawn = true;
        
        // Update pool stats
        pools[stakeInfo.poolId].totalStaked -= stakeInfo.amount;
        totalStaked -= stakeInfo.amount;

        // Process exit fee
        _distributeFees(exitFee, isEarly ? "Early Exit Penalty" : "Exit Fee");
        
        // Transfer principal back to user
        IERC20(address(lotToken)).safeTransfer(msg.sender, withdrawAmount);
        
        // Auto-claim pending rewards if any
        if (pendingRewards > 0) {
            _claimRewards(msg.sender, stakeId, pendingRewards);
        }
        
        emit Unstaked(msg.sender, stakeId, withdrawAmount, exitFee);
    }

    /**
     * @dev Claim pending rewards for a specific stake
     * @param stakeId Stake ID to claim rewards for
     */
    function claimRewards(uint256 stakeId) external nonReentrant {
        require(stakeId < userStakeCount[msg.sender], "Invalid stake ID");
        
        StakeInfo storage stakeInfo = userStakes[msg.sender][stakeId];
        require(!stakeInfo.withdrawn, "Stake already withdrawn");
        
        uint256 pendingRewards = calculatePendingRewards(msg.sender, stakeId);
        require(pendingRewards > 0, "No rewards to claim");
        
        _claimRewards(msg.sender, stakeId, pendingRewards);
    }

    /**
     * @dev Internal function to process reward claims
     */
    function _claimRewards(address user, uint256 stakeId, uint256 rewardAmount) internal {
        StakeInfo storage stakeInfo = userStakes[user][stakeId];
        
        // Calculate claim tax
        uint256 claimTax = (rewardAmount * REWARD_CLAIM_TAX) / 10000;
        uint256 netReward = rewardAmount - claimTax;
        
        // Update stake info
        stakeInfo.lastClaimTime = block.timestamp;
        stakeInfo.rewardsClaimed += rewardAmount;
        
        // Update global stats
        totalRewardsDistributed += rewardAmount;
        
        // Process claim tax
        _distributeFees(claimTax, "Reward Claim Tax");
        
        // Transfer net rewards to user
        IERC20(address(lotToken)).safeTransfer(user, netReward);
        
        emit RewardsClaimed(user, stakeId, netReward, claimTax);
    }

    /**
     * @dev Distribute fees according to tokenomics
     */
    function _distributeFees(uint256 feeAmount, string memory feeType) internal {
        if (feeAmount == 0) return;
        
        uint256 burnAmount = (feeAmount * BURN_PERCENTAGE) / 10000;
        uint256 rewardPoolAmount = (feeAmount * REWARD_POOL_PERCENTAGE) / 10000;
        uint256 treasuryAmount = feeAmount - burnAmount - rewardPoolAmount;
        
        // Burn tokens
        if (burnAmount > 0) {
            lotToken.burnWithReason(burnAmount, feeType);
            totalFeesBurned += burnAmount;
        }
        
        // Send to reward pool
        if (rewardPoolAmount > 0) {
            IERC20(address(lotToken)).safeTransfer(rewardPool, rewardPoolAmount);
            _addYieldSource(string(abi.encodePacked("Fee Distribution: ", feeType)), rewardPoolAmount);
        }
        
        // Send to treasury
        if (treasuryAmount > 0) {
            IERC20(address(lotToken)).safeTransfer(treasury, treasuryAmount);
        }
        
        totalFeesCollected += feeAmount;
        
        emit FeesDistributed(burnAmount, rewardPoolAmount, treasuryAmount);
    }

    /**
     * @dev Calculate pending rewards for a stake
     */
    function calculatePendingRewards(address user, uint256 stakeId) public view returns (uint256) {
        if (stakeId >= userStakeCount[user]) return 0;
        
        StakeInfo storage stakeInfo = userStakes[user][stakeId];
        if (stakeInfo.withdrawn || stakeInfo.amount == 0) return 0;
        
        PoolConfig storage pool = pools[stakeInfo.poolId];
        
        uint256 stakingTime = block.timestamp - stakeInfo.lastClaimTime;
        uint256 maxStakingTime = stakeInfo.endTime - stakeInfo.startTime;
        
        // Cap staking time to pool duration
        if (stakingTime > maxStakingTime) {
            stakingTime = maxStakingTime;
        }
        
        // Calculate rewards: (amount * APY * time) / (365 days * 10000)
        uint256 reward = (stakeInfo.amount * pool.apy * stakingTime) / (365 days * 10000);
        
        return reward;
    }

    /**
     * @dev Add yield source for PoY tracking
     */
    function addYieldSource(string memory name, uint256 amount) external onlyOwner {
        _addYieldSource(name, amount);
    }

    /**
     * @dev Internal function to add yield source
     */
    function _addYieldSource(string memory name, uint256 amount) internal {
        yieldSources.push(YieldSource({
            name: name,
            amount: amount,
            timestamp: block.timestamp
        }));
        
        totalYieldGenerated += amount;
        
        emit YieldSourceAdded(name, amount);
    }

    /**
     * @dev Get user's all stakes
     */
    function getUserStakes(address user) external view returns (StakeInfo[] memory) {
        return userStakes[user];
    }

    /**
     * @dev Get pool information
     */
    function getPoolInfo(uint256 poolId) external view returns (PoolConfig memory) {
        require(poolId < poolCount, "Invalid pool ID");
        return pools[poolId];
    }

    /**
     * @dev Get all pools information
     */
    function getAllPools() external view returns (PoolConfig[] memory) {
        PoolConfig[] memory allPools = new PoolConfig[](poolCount);
        for (uint256 i = 0; i < poolCount; i++) {
            allPools[i] = pools[i];
        }
        return allPools;
    }

    /**
     * @dev Get yield sources for PoY
     */
    function getYieldSources() external view returns (YieldSource[] memory) {
        return yieldSources;
    }

    /**
     * @dev Get contract statistics
     */
    function getContractStats() external view returns (
        uint256 totalStaked_,
        uint256 totalRewardsDistributed_,
        uint256 totalFeesBurned_,
        uint256 totalFeesCollected_,
        uint256 totalYieldGenerated_,
        uint256 contractBalance
    ) {
        totalStaked_ = totalStaked;
        totalRewardsDistributed_ = totalRewardsDistributed;
        totalFeesBurned_ = totalFeesBurned;
        totalFeesCollected_ = totalFeesCollected;
        totalYieldGenerated_ = totalYieldGenerated;
        contractBalance = lotToken.balanceOf(address(this));
    }

    /**
     * @dev Create new staking pool (admin only)
     */
    function createPool(uint256 duration, uint256 apy) external onlyOwner {
        pools[poolCount] = PoolConfig({
            duration: duration,
            apy: apy,
            totalStaked: 0,
            active: true
        });
        
        emit PoolCreated(poolCount, duration, apy);
        poolCount++;
    }

    /**
     * @dev Toggle pool status
     */
    function togglePoolStatus(uint256 poolId) external onlyOwner {
        require(poolId < poolCount, "Invalid pool ID");
        pools[poolId].active = !pools[poolId].active;
        emit PoolStatusChanged(poolId, pools[poolId].active);
    }

    /**
     * @dev Update treasury address
     */
    function updateTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury address");
        treasury = newTreasury;
    }

    /**
     * @dev Update reward pool address
     */
    function updateRewardPool(address newRewardPool) external onlyOwner {
        require(newRewardPool != address(0), "Invalid reward pool address");
        rewardPool = newRewardPool;
    }

    /**
     * @dev Pause contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Emergency withdrawal for users (testnet safety)
     */
function emergencyWithdraw(uint256 stakeId) external nonReentrant {
    require(paused(), "Only available when paused");
    require(stakeId < userStakeCount[msg.sender], "Invalid stake ID");
    
    StakeInfo storage stakeInfo = userStakes[msg.sender][stakeId];
    require(!stakeInfo.withdrawn, "Already withdrawn");
    require(stakeInfo.amount > 0, "No stake found");
    
    // Calculate emergency withdrawal fee
    uint256 emergencyFee = (stakeInfo.amount * EMERGENCY_WITHDRAWAL_FEE) / 10000;
    uint256 withdrawAmount = stakeInfo.amount - emergencyFee;
    
    // Update state first
    stakeInfo.withdrawn = true;
    pools[stakeInfo.poolId].totalStaked -= stakeInfo.amount;
    totalStaked -= stakeInfo.amount;
    
    // Distribute emergency fee
    _distributeFees(emergencyFee, "Emergency Withdrawal Fee");
    
    // Transfer reduced amount back to user
    IERC20(address(lotToken)).safeTransfer(msg.sender, withdrawAmount);
    
    emit EmergencyWithdrawal(msg.sender, withdrawAmount);
}

    /**
     * @dev Admin emergency withdrawal (testnet only)
     */
    function adminEmergencyWithdraw(uint256 amount) external onlyOwner {
        require(amount <= lotToken.balanceOf(address(this)), "Insufficient balance");
        IERC20(address(lotToken)).safeTransfer(owner(), amount);
    }
}
