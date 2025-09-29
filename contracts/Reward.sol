// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract Reward is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public rewardToken;
    uint256 public constant MAX_REWARD = 10000 * 1e18; 

    mapping(bytes32 => bool) public usedSignatures;
    mapping(address => uint256) public totalRewardClaimedByUser;
    mapping(address => uint256) public totalNumberOfRewardClaimedByUser;

    event RewardContractInitialized(address indexed rewardToken, uint256 timestamp);
    event RewardClaimedByUser(address indexed user, uint256 indexed rewardAmount, uint256 timestamp);
    event TotalNumberOfRewardClaimedByUser(address indexed user, uint256 indexed numberOfRewardClaimed, uint256 timestamp);

    constructor(address _rewardToken) Ownable(msg.sender) {
        require(_rewardToken != address(0), "Invalid token address");
        
        rewardToken = IERC20(_rewardToken);
        
        emit RewardContractInitialized(_rewardToken, block.timestamp);
    }

   
    function claimReward(
        uint256 nonce,
        uint256 _rewardAmount,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        require(_rewardAmount > 0, "Reward amount must be greater than 0");
        require(_rewardAmount <= MAX_REWARD, "Reward amount exceeds maximum");
        require(rewardToken.balanceOf(address(this)) >= _rewardAmount, "Insufficient reward token balance in contract");

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                msg.sender,      
                nonce,
                _rewardAmount,  
                address(this),   
                block.chainid  
            )
        );

        require(!usedSignatures[messageHash], "Signature already used");

        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );

        address recoveredSigner = ECDSA.recover(ethSignedMessageHash, signature);

        require(recoveredSigner == owner(), "Invalid signature - not from contract owner");

        usedSignatures[messageHash] = true;

        totalRewardClaimedByUser[msg.sender] += _rewardAmount;
        totalNumberOfRewardClaimedByUser[msg.sender] += 1;

        rewardToken.safeTransfer(msg.sender, _rewardAmount);

        emit RewardClaimedByUser(msg.sender, _rewardAmount, block.timestamp);
        emit TotalNumberOfRewardClaimedByUser(msg.sender, totalNumberOfRewardClaimedByUser[msg.sender], block.timestamp);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function fundContract(uint256 _amount) external {
        require(_amount > 0, "Amount must be greater than 0");
        rewardToken.safeTransferFrom(msg.sender, address(this), _amount);
    }

    function emergencyWithdraw(uint256 _amount) external onlyOwner {
        require(_amount > 0, "Amount must be greater than 0");
        require(_amount <= rewardToken.balanceOf(address(this)), "Insufficient contract balance");
        rewardToken.safeTransfer(msg.sender, _amount);
    }

    function isSignatureUsed(address user, uint256 nonce, uint256 _rewardAmount) external view returns (bool) {
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                user,
                nonce,
                _rewardAmount,   
                address(this),
                block.chainid
            )
        );
        return usedSignatures[messageHash];
    }

    function getContractBalance() external view returns (uint256) {
        return rewardToken.balanceOf(address(this));
    }
}