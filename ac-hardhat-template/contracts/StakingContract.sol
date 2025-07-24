// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract StakingContract is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable stakingToken;
    
    struct Stake {
        uint128 amount;
        uint64 endTime;
        uint32 rate;
        uint32 rewardClaimed;
        bool withdrawn;
    }

    mapping(uint256 => uint256) public termRates;
    mapping(address => Stake[]) private _userStakes;
    mapping(address => uint256) public userStakeCount;
    uint256[] public availableTerms;
    uint256 public penaltyRate = 100;

    event Deposited(address indexed user, uint256 indexed stakeId, uint256 amount, uint256 term);
    event Claimed(address indexed user, uint256 indexed stakeId, uint256 reward);
    event Withdrawn(address indexed user, uint256 indexed stakeId, uint256 amount, uint256 reward, uint256 penalty);
    event TermRateUpdated(uint256 indexed term, uint256 oldRate, uint256 newRate);
    event PenaltyRateUpdated(uint256 oldRate, uint256 newRate);

    error InvalidInput();
    error InvalidStake();
    error NotReady();

    constructor(address _token) Ownable(msg.sender) {
        stakingToken = IERC20(_token);
        uint256[3] memory terms = [uint256(90 days), 180 days, 365 days];
        uint256[3] memory rates = [uint256(25), 125, 600];
        for (uint256 i; i < 3; ++i) {
            termRates[terms[i]] = rates[i];
            availableTerms.push(terms[i]);
        }
    }

    function deposit(uint256 amount, uint256 term) external nonReentrant {
        if (amount == 0 || termRates[term] == 0) revert InvalidInput();
        
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        _userStakes[msg.sender].push(Stake({
            amount: uint128(amount),
            endTime: uint64(block.timestamp + term),
            rate: uint32(termRates[term]),
            rewardClaimed: 0,
            withdrawn: false
        }));
        
        emit Deposited(msg.sender, userStakeCount[msg.sender]++, amount, term);
    }

    function claim(uint256 stakeId) external nonReentrant {
        Stake storage s = _getValidStake(msg.sender, stakeId);
        if (block.timestamp < s.endTime) revert NotReady();
        
        uint256 reward = (uint256(s.amount) * (s.rate - s.rewardClaimed)) / 10000;
        if (reward == 0) revert InvalidInput();
        
        s.rewardClaimed = s.rate;
        stakingToken.safeTransfer(msg.sender, reward);
        emit Claimed(msg.sender, stakeId, reward);
    }

    function withdraw(uint256 stakeId) external nonReentrant {
        Stake storage s = _getValidStake(msg.sender, stakeId);
        
        uint256 amount = s.amount;
        uint256 penalty = 0;
        uint256 reward = 0;
        
        if (block.timestamp < s.endTime) {
            penalty = (amount * penaltyRate) / 10000;
            amount -= penalty;
        } else {
            reward = (amount * (s.rate - s.rewardClaimed)) / 10000;
            amount += reward;
        }
        
        s.withdrawn = true;
        stakingToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, stakeId, s.amount, reward, penalty);
    }

    function setTermRate(uint256 term, uint256 newRate) external onlyOwner {
        if (newRate > 5000) revert InvalidInput();
        
        uint256 oldRate = termRates[term];
        termRates[term] = newRate;
        
        if (oldRate == 0 && newRate > 0) availableTerms.push(term);
        else if (oldRate > 0 && newRate == 0) _removeFromAvailableTerms(term);
        
        emit TermRateUpdated(term, oldRate, newRate);
    }

    function setPenaltyRate(uint256 newRate) external onlyOwner {
        if (newRate > 1000) revert InvalidInput();
        emit PenaltyRateUpdated(penaltyRate, newRate);
        penaltyRate = newRate;
    }

    function emergencyWithdraw(uint256 amount) external onlyOwner {
        stakingToken.safeTransfer(msg.sender, amount);
    }

    function getStake(address user, uint256 stakeId) external view returns (Stake memory) {
        if (stakeId >= userStakeCount[user]) revert InvalidStake();
        return _userStakes[user][stakeId];
    }

    function getStakes(address user) external view returns (Stake[] memory) {
        return _userStakes[user];
    }

    function getReward(address user, uint256 stakeId) external view returns (uint256) {
        if (stakeId >= userStakeCount[user]) return 0;
        Stake memory s = _userStakes[user][stakeId];
        return (s.withdrawn || block.timestamp < s.endTime) ? 0 : 
               (uint256(s.amount) * (s.rate - s.rewardClaimed)) / 10000;
    }

    function getAvailableTerms() external view returns (uint256[] memory) {
        return availableTerms;
    }

    // Backward compatibility
    function TERM_3_MONTHS() external pure returns (uint256) { return 90 days; }
    function TERM_6_MONTHS() external pure returns (uint256) { return 180 days; }
    function TERM_12_MONTHS() external pure returns (uint256) { return 365 days; }
    function RATE_3_MONTHS() external view returns (uint256) { return termRates[90 days]; }
    function RATE_6_MONTHS() external view returns (uint256) { return termRates[180 days]; }
    function RATE_12_MONTHS() external view returns (uint256) { return termRates[365 days]; }
    function PENALTY_RATE() external view returns (uint256) { return penaltyRate; }

    function _getValidStake(address user, uint256 stakeId) internal view returns (Stake storage) {
        if (stakeId >= userStakeCount[user]) revert InvalidStake();
        Stake storage s = _userStakes[user][stakeId];
        if (s.withdrawn) revert InvalidStake();
        return s;
    }

    function _removeFromAvailableTerms(uint256 term) internal {
        for (uint256 i; i < availableTerms.length; ++i) {
            if (availableTerms[i] == term) {
                availableTerms[i] = availableTerms[availableTerms.length - 1];
                availableTerms.pop();
                break;
            }
        }
    }
}