// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title StakingContract
 * @dev A staking contract with fixed terms and interest rates
 */
contract StakingContract is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Constants
    IERC20 public immutable stakingToken;
    
    uint256 public constant TERM_3_MONTHS = 90 days;
    uint256 public constant TERM_6_MONTHS = 180 days;
    uint256 public constant TERM_12_MONTHS = 365 days;
    
    uint256 public constant INTEREST_3_MONTHS = 100;   // 1% APY
    uint256 public constant INTEREST_6_MONTHS = 250;   // 2.5% APY
    uint256 public constant INTEREST_12_MONTHS = 600;  // 6% APY
    
    uint256 public constant EARLY_WITHDRAWAL_PENALTY = 100; // 1%
    uint256 private constant BASIS_POINTS = 10000;
    uint256 private constant SECONDS_PER_YEAR = 365 days;

    // Structs
    struct Stake {
        uint128 amount;
        uint128 rewardClaimed;
        uint64 startTime;
        uint64 endTime;
        uint32 interestRate;
        bool withdrawn;
    }

    // State variables
    mapping(address => Stake[]) public userStakes;
    mapping(address => uint256) public userStakeCount;

    // Events
    event Deposited(address indexed user, uint256 indexed stakeId, uint256 amount, uint256 term, uint256 interestRate);
    event RewardClaimed(address indexed user, uint256 indexed stakeId, uint256 reward);
    event Withdrawn(address indexed user, uint256 indexed stakeId, uint256 amount, uint256 reward, uint256 penalty);
    event EmergencyWithdraw(address indexed owner, uint256 amount);

    // Custom errors
    error InvalidAmount();
    error InvalidTerm();
    error InvalidStakeId();
    error StakeAlreadyWithdrawn();
    error TermNotCompleted();
    error NoRewardsToClaim();
    error InsufficientContractBalance();

    constructor(address _stakingToken) Ownable(msg.sender) {
        if (_stakingToken == address(0)) revert InvalidAmount();
        stakingToken = IERC20(_stakingToken);
    }

    /**
     * @dev Deposit tokens for staking
     */
    function deposit(uint256 amount, uint256 term) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (!isValidTerm(term)) revert InvalidTerm();

        uint256 interestRate = getInterestRate(term);
        
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        Stake memory newStake = Stake({
            amount: uint128(amount),
            rewardClaimed: 0,
            startTime: uint64(block.timestamp),
            endTime: uint64(block.timestamp + term),
            interestRate: uint32(interestRate),
            withdrawn: false
        });

        userStakes[msg.sender].push(newStake);
        uint256 stakeId = userStakeCount[msg.sender]++;

        emit Deposited(msg.sender, stakeId, amount, term, interestRate);
    }

    /**
     * @dev Claim rewards after term completion
     */
    function claim(uint256 stakeId) external nonReentrant {
        Stake storage stake = _getValidStake(msg.sender, stakeId);
        
        if (stake.withdrawn) revert StakeAlreadyWithdrawn();
        if (block.timestamp < stake.endTime) revert TermNotCompleted();

        uint256 totalReward = _calculateReward(stake.amount, stake.interestRate, stake.endTime - stake.startTime);
        uint256 unclaimedReward = totalReward - stake.rewardClaimed;
        
        if (unclaimedReward == 0) revert NoRewardsToClaim();
        if (stakingToken.balanceOf(address(this)) < unclaimedReward) revert InsufficientContractBalance();

        stake.rewardClaimed = uint128(totalReward);
        stakingToken.safeTransfer(msg.sender, unclaimedReward);

        emit RewardClaimed(msg.sender, stakeId, unclaimedReward);
    }

    /**
     * @dev Withdraw staked amount and rewards
     */
    function withdraw(uint256 stakeId) external nonReentrant {
        Stake storage stake = _getValidStake(msg.sender, stakeId);
        
        if (stake.withdrawn) revert StakeAlreadyWithdrawn();

        bool isEarly = block.timestamp < stake.endTime;
        uint256 withdrawAmount;
        uint256 penalty = 0;
        uint256 reward = 0;

        if (isEarly) {
            penalty = (uint256(stake.amount) * EARLY_WITHDRAWAL_PENALTY) / BASIS_POINTS;
            withdrawAmount = stake.amount - penalty;
        } else {
            uint256 totalReward = _calculateReward(stake.amount, stake.interestRate, stake.endTime - stake.startTime);
            reward = totalReward - stake.rewardClaimed;
            withdrawAmount = stake.amount + reward;
        }

        if (stakingToken.balanceOf(address(this)) < withdrawAmount) revert InsufficientContractBalance();

        stake.withdrawn = true;
        stakingToken.safeTransfer(msg.sender, withdrawAmount);

        emit Withdrawn(msg.sender, stakeId, stake.amount, reward, penalty);
    }

    /**
     * @dev Emergency withdraw function for owner
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        if (amount == 0) revert InvalidAmount();
        if (stakingToken.balanceOf(address(this)) < amount) revert InsufficientContractBalance();
        
        stakingToken.safeTransfer(owner(), amount);
        emit EmergencyWithdraw(owner(), amount);
    }

    // View functions
    function calculateReward(uint256 amount, uint256 interestRate, uint256 term) public pure returns (uint256) {
        return _calculateReward(amount, interestRate, term);
    }

    function isValidTerm(uint256 term) public pure returns (bool) {
        return term == TERM_3_MONTHS || term == TERM_6_MONTHS || term == TERM_12_MONTHS;
    }

    function getInterestRate(uint256 term) public pure returns (uint256) {
        if (term == TERM_3_MONTHS) return INTEREST_3_MONTHS;
        if (term == TERM_6_MONTHS) return INTEREST_6_MONTHS;
        if (term == TERM_12_MONTHS) return INTEREST_12_MONTHS;
        revert InvalidTerm();
    }

    function getUserStake(address user, uint256 stakeId) external view returns (Stake memory) {
        return _getValidStake(user, stakeId);
    }

    function getUserStakes(address user) external view returns (Stake[] memory) {
        return userStakes[user];
    }

    function getContractBalance() external view returns (uint256) {
        return stakingToken.balanceOf(address(this));
    }

    function getAvailableReward(address user, uint256 stakeId) external view returns (uint256) {
        Stake memory stake = _getValidStake(user, stakeId);
        
        if (stake.withdrawn || block.timestamp < stake.endTime) {
            return 0;
        }

        uint256 totalReward = _calculateReward(stake.amount, stake.interestRate, stake.endTime - stake.startTime);
        return totalReward - stake.rewardClaimed;
    }

    // Internal functions
    function _calculateReward(uint256 amount, uint256 interestRate, uint256 term) internal pure returns (uint256) {
        return (amount * interestRate * term) / (BASIS_POINTS * SECONDS_PER_YEAR);
    }

    function _getValidStake(address user, uint256 stakeId) internal view returns (Stake storage) {
        if (stakeId >= userStakeCount[user]) revert InvalidStakeId();
        return userStakes[user][stakeId];
    }
}