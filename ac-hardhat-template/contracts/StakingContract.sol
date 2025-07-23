// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract StakingContract is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable stakingToken;
    
    uint256 public constant TERM_3_MONTHS = 90 days;
    uint256 public constant TERM_6_MONTHS = 180 days;
    uint256 public constant TERM_12_MONTHS = 365 days;
    
    uint256 public constant RATE_3_MONTHS = 100;    // 1%
    uint256 public constant RATE_6_MONTHS = 250;    // 2.5%
    uint256 public constant RATE_12_MONTHS = 600;   // 6%
    uint256 public constant PENALTY_RATE = 100;     // 1%

    struct Stake {
        uint128 amount;
        uint128 rewardClaimed;
        uint64 endTime;
        uint32 rate;
        bool withdrawn;
    }

    mapping(address => Stake[]) public userStakes;
    mapping(address => uint256) public userStakeCount;

    event Deposited(address indexed user, uint256 indexed stakeId, uint256 amount, uint256 term);
    event Claimed(address indexed user, uint256 indexed stakeId, uint256 reward);
    event Withdrawn(address indexed user, uint256 indexed stakeId, uint256 principal, uint256 reward, uint256 penalty);

    error InvalidInput();
    error InvalidStake();
    error NotReady();
    error InsufficientBalance();

    constructor(address _token) Ownable(msg.sender) {
        stakingToken = IERC20(_token);
    }

    function deposit(uint256 amount, uint256 term) external nonReentrant {
        if (amount == 0) revert InvalidInput();
        
        uint256 rate;
        if (term == TERM_3_MONTHS) rate = RATE_3_MONTHS;
        else if (term == TERM_6_MONTHS) rate = RATE_6_MONTHS;
        else if (term == TERM_12_MONTHS) rate = RATE_12_MONTHS;
        else revert InvalidInput();
        
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        userStakes[msg.sender].push(Stake({
            amount: uint128(amount),
            rewardClaimed: 0,
            endTime: uint64(block.timestamp + term),
            rate: uint32(rate),
            withdrawn: false
        }));

        emit Deposited(msg.sender, userStakeCount[msg.sender]++, amount, term);
    }

    function claim(uint256 stakeId) external nonReentrant {
        if (stakeId >= userStakeCount[msg.sender]) revert InvalidStake();
        
        Stake storage s = userStakes[msg.sender][stakeId];
        if (s.withdrawn) revert InvalidStake();
        if (block.timestamp < s.endTime) revert NotReady();

        uint256 reward = (uint256(s.amount) * s.rate) / 10000 - s.rewardClaimed;
        if (reward == 0) revert InvalidInput();

        s.rewardClaimed += uint128(reward);
        stakingToken.safeTransfer(msg.sender, reward);
        
        emit Claimed(msg.sender, stakeId, reward);
    }

    function withdraw(uint256 stakeId) external nonReentrant {
        if (stakeId >= userStakeCount[msg.sender]) revert InvalidStake();
        
        Stake storage s = userStakes[msg.sender][stakeId];
        if (s.withdrawn) revert InvalidStake();

        uint256 amount;
        uint256 penalty = 0;
        uint256 reward = 0;

        if (block.timestamp < s.endTime) {
            // Early withdrawal
            penalty = (uint256(s.amount) * PENALTY_RATE) / 10000;
            amount = s.amount - penalty;
        } else {
            // Normal withdrawal
            reward = (uint256(s.amount) * s.rate) / 10000 - s.rewardClaimed;
            amount = s.amount + reward;
        }

        s.withdrawn = true;
        stakingToken.safeTransfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, stakeId, s.amount, reward, penalty);
    }

    function emergencyWithdraw(uint256 amount) external onlyOwner {
        stakingToken.safeTransfer(owner(), amount);
    }

    function getStake(address user, uint256 stakeId) external view returns (Stake memory) {
        if (stakeId >= userStakeCount[user]) revert InvalidStake();
        return userStakes[user][stakeId];
    }

    function getStakes(address user) external view returns (Stake[] memory) {
        return userStakes[user];
    }

    function getReward(address user, uint256 stakeId) external view returns (uint256) {
        if (stakeId >= userStakeCount[user]) return 0;
        Stake memory s = userStakes[user][stakeId];
        if (s.withdrawn || block.timestamp < s.endTime) return 0;
        return (uint256(s.amount) * s.rate) / 10000 - s.rewardClaimed;
    }
}