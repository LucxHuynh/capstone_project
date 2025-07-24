import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { StakingContract, MyToken } from "../typechain";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import "@nomicfoundation/hardhat-chai-matchers";

describe("StakingContract Complete Tests", function () {
  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const DEPOSIT_AMOUNT = ethers.parseEther("1000");
  const TERM_3M = 90 * 24 * 60 * 60;
  const TERM_6M = 180 * 24 * 60 * 60;
  const TERM_12M = 365 * 24 * 60 * 60;

  // Expected rewards based on current rates: 25, 125, 600 basis points
  const REWARD_3M = ethers.parseEther("2.5");   // 1000 * 0.25%
  const REWARD_6M = ethers.parseEther("12.5");  // 1000 * 1.25%
  const REWARD_12M = ethers.parseEther("60");   // 1000 * 6%
  const PENALTY = ethers.parseEther("10");      // 1000 * 1%

  async function deployFixture() {
    const [deployer, user1, user2] = await ethers.getSigners();
    
    const TokenFactory = await ethers.getContractFactory("MyToken");
    const usdc = await TokenFactory.deploy("USD Coin", "USDC", INITIAL_SUPPLY);
    
    const StakingFactory = await ethers.getContractFactory("StakingContract");
    const staking = await StakingFactory.deploy(await usdc.getAddress());
    
    // Setup balances
    await usdc.transfer(user1.address, ethers.parseEther("10000"));
    await usdc.transfer(user2.address, ethers.parseEther("10000"));
    await usdc.transfer(await staking.getAddress(), ethers.parseEther("100000"));
    
    return { deployer, user1, user2, usdc, staking };
  }

  describe("1. Initialization", function () {
    it("Should initialize correctly", async function () {
      const { usdc, staking } = await loadFixture(deployFixture);
      
      expect(await staking.stakingToken()).to.equal(await usdc.getAddress());
      expect(await staking.RATE_3_MONTHS()).to.equal(25);
      expect(await staking.RATE_6_MONTHS()).to.equal(125);
      expect(await staking.RATE_12_MONTHS()).to.equal(600);
      expect(await staking.PENALTY_RATE()).to.equal(100);
      
      const availableTerms = await staking.getAvailableTerms();
      expect(availableTerms).to.have.length(3);
      expect(availableTerms.map(t => Number(t))).to.include(TERM_3M);
      expect(availableTerms.map(t => Number(t))).to.include(TERM_6M);
      expect(availableTerms.map(t => Number(t))).to.include(TERM_12M);
    });
  });

  describe("2. Deposit Logic", function () {
    it("Should deposit correctly with all terms", async function () {
      const { user1, usdc, staking } = await loadFixture(deployFixture);
      
      await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT * 3n);
      
      // Test all 3 terms
      await expect(staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_3M))
        .to.emit(staking, "Deposited")
        .withArgs(user1.address, 0, DEPOSIT_AMOUNT, TERM_3M);
        
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_6M);
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_12M);
      
      expect(await staking.userStakeCount(user1.address)).to.equal(3);
      
      const stake1 = await staking.getStake(user1.address, 0);
      const stake2 = await staking.getStake(user1.address, 1);
      const stake3 = await staking.getStake(user1.address, 2);
      
      expect(stake1.rate).to.equal(25);
      expect(stake2.rate).to.equal(125);
      expect(stake3.rate).to.equal(600);
    });

    it("Should reject invalid deposits", async function () {
      const { user1, usdc, staking } = await loadFixture(deployFixture);
      
      await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT);
      
      // Zero amount
      await expect(staking.connect(user1).deposit(0, TERM_3M))
        .to.be.revertedWithCustomError(staking, "InvalidInput");
        
      // Invalid term
      await expect(staking.connect(user1).deposit(DEPOSIT_AMOUNT, 45 * 24 * 60 * 60))
        .to.be.revertedWithCustomError(staking, "InvalidInput");
    });
  });

  describe("3. Claim Logic", function () {
    it("Should calculate rewards correctly", async function () {
      const { user1, usdc, staking } = await loadFixture(deployFixture);
      
      await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT * 3n);
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_3M);
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_6M);
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_12M);
      
      await time.increase(TERM_12M);
      
      // Test all rewards
      const balance0 = await usdc.balanceOf(user1.address);
      await staking.connect(user1).claim(0);
      expect(await usdc.balanceOf(user1.address) - balance0).to.equal(REWARD_3M);
      
      const balance1 = await usdc.balanceOf(user1.address);
      await staking.connect(user1).claim(1);
      expect(await usdc.balanceOf(user1.address) - balance1).to.equal(REWARD_6M);
      
      const balance2 = await usdc.balanceOf(user1.address);
      await staking.connect(user1).claim(2);
      expect(await usdc.balanceOf(user1.address) - balance2).to.equal(REWARD_12M);
    });

    it("Should prevent invalid claims", async function () {
      const { user1, usdc, staking } = await loadFixture(deployFixture);
      
      await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT);
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_3M);
      
      // Early claim
      await expect(staking.connect(user1).claim(0))
        .to.be.revertedWithCustomError(staking, "NotReady");
        
      await time.increase(TERM_3M);
      
      // First claim ok
      await staking.connect(user1).claim(0);
      
      // Double claim
      await expect(staking.connect(user1).claim(0))
        .to.be.revertedWithCustomError(staking, "InvalidInput");
        
      // Invalid stake ID
      await expect(staking.connect(user1).claim(999))
        .to.be.revertedWithCustomError(staking, "InvalidStake");
    });
  });

  describe("4. Withdraw Logic", function () {
    it("Should handle early withdrawal with penalty", async function () {
      const { user1, usdc, staking } = await loadFixture(deployFixture);
      
      await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT);
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_6M);
      
      const balanceBefore = await usdc.balanceOf(user1.address);
      await staking.connect(user1).withdraw(0);
      const received = await usdc.balanceOf(user1.address) - balanceBefore;
      
      expect(received).to.equal(DEPOSIT_AMOUNT - PENALTY);
    });

    it("Should handle normal withdrawal with rewards", async function () {
      const { user1, usdc, staking } = await loadFixture(deployFixture);
      
      await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT);
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_6M);
      
      await time.increase(TERM_6M);
      
      const balanceBefore = await usdc.balanceOf(user1.address);
      await staking.connect(user1).withdraw(0);
      const received = await usdc.balanceOf(user1.address) - balanceBefore;
      
      expect(received).to.equal(DEPOSIT_AMOUNT + REWARD_6M);
    });

    it("Should handle claim then withdraw", async function () {
      const { user1, usdc, staking } = await loadFixture(deployFixture);
      
      await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT);
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_3M);
      
      await time.increase(TERM_3M);
      
      // Claim first
      await staking.connect(user1).claim(0);
      
      // Then withdraw should only return principal
      const balanceBefore = await usdc.balanceOf(user1.address);
      await staking.connect(user1).withdraw(0);
      const received = await usdc.balanceOf(user1.address) - balanceBefore;
      
      expect(received).to.equal(DEPOSIT_AMOUNT);
    });

    it("Should prevent invalid withdrawals", async function () {
      const { user1, usdc, staking } = await loadFixture(deployFixture);
      
      await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT);
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_3M);
      
      // First withdrawal ok
      await staking.connect(user1).withdraw(0);
      
      // Double withdrawal
      await expect(staking.connect(user1).withdraw(0))
        .to.be.revertedWithCustomError(staking, "InvalidStake");
        
      // Invalid stake ID  
      await expect(staking.connect(user1).withdraw(999))
        .to.be.revertedWithCustomError(staking, "InvalidStake");
    });
  });

  describe("5. Admin Functions", function () {
    it("Should update term rates", async function () {
      const { deployer, staking } = await loadFixture(deployFixture);
      
      await expect(staking.connect(deployer).setTermRate(TERM_3M, 500))
        .to.emit(staking, "TermRateUpdated")
        .withArgs(TERM_3M, 25, 500);
        
      expect(await staking.RATE_3_MONTHS()).to.equal(500);
    });

    it("Should add/remove terms dynamically", async function () {
      const { deployer, user1, usdc, staking } = await loadFixture(deployFixture);
      
      const newTerm = 30 * 24 * 60 * 60; // 30 days
      
      // Add new term
      await staking.connect(deployer).setTermRate(newTerm, 50);
      
      const termsAfter = await staking.getAvailableTerms();
      expect(termsAfter.map(t => Number(t))).to.include(newTerm);
      
      // Should be able to deposit
      await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT);
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, newTerm);
      
      // Remove term
      await staking.connect(deployer).setTermRate(newTerm, 0);
      
      const termsAfterRemove = await staking.getAvailableTerms();
      expect(termsAfterRemove.map(t => Number(t))).to.not.include(newTerm);
      
      // Should not be able to deposit
      await expect(staking.connect(user1).deposit(DEPOSIT_AMOUNT, newTerm))
        .to.be.revertedWithCustomError(staking, "InvalidInput");
    });

    it("Should update penalty rate", async function () {
      const { deployer, user1, usdc, staking } = await loadFixture(deployFixture);
      
      await expect(staking.connect(deployer).setPenaltyRate(200))
        .to.emit(staking, "PenaltyRateUpdated")
        .withArgs(100, 200);
        
      expect(await staking.PENALTY_RATE()).to.equal(200);
      
      // Test new penalty rate
      await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT);
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_6M);
      
      const balanceBefore = await usdc.balanceOf(user1.address);
      await staking.connect(user1).withdraw(0);
      const received = await usdc.balanceOf(user1.address) - balanceBefore;
      
      expect(received).to.equal(DEPOSIT_AMOUNT - ethers.parseEther("20")); // 2% penalty
    });

    it("Should reject invalid admin operations", async function () {
      const { deployer, user1, staking } = await loadFixture(deployFixture);
      
      // Non-owner access
      await expect(staking.connect(user1).setTermRate(TERM_3M, 100))
        .to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount");
        
      await expect(staking.connect(user1).setPenaltyRate(200))
        .to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount");
        
      await expect(staking.connect(user1).emergencyWithdraw(1000))
        .to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount");
        
      // Invalid rates
      await expect(staking.connect(deployer).setTermRate(TERM_3M, 5001))
        .to.be.revertedWithCustomError(staking, "InvalidInput");
        
      await expect(staking.connect(deployer).setPenaltyRate(1001))
        .to.be.revertedWithCustomError(staking, "InvalidInput");
    });

    it("Should emergency withdraw", async function () {
      const { deployer, usdc, staking } = await loadFixture(deployFixture);
      
      const amount = ethers.parseEther("1000");
      const balanceBefore = await usdc.balanceOf(deployer.address);
      
      await staking.connect(deployer).emergencyWithdraw(amount);
      
      const received = await usdc.balanceOf(deployer.address) - balanceBefore;
      expect(received).to.equal(amount);
    });
  });

  describe("6. View Functions", function () {
    it("Should return correct stake info", async function () {
      const { user1, usdc, staking } = await loadFixture(deployFixture);
      
      await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT * 2n);
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_3M);
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_6M);
      
      const stake = await staking.getStake(user1.address, 0);
      expect(stake.amount).to.equal(DEPOSIT_AMOUNT);
      expect(stake.rate).to.equal(25);
      expect(stake.rewardClaimed).to.equal(0);
      expect(stake.withdrawn).to.be.false;
      
      const allStakes = await staking.getStakes(user1.address);
      expect(allStakes).to.have.length(2);
      
      expect(await staking.userStakeCount(user1.address)).to.equal(2);
    });

    it("Should calculate rewards correctly", async function () {
      const { user1, usdc, staking } = await loadFixture(deployFixture);
      
      await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT);
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_6M);
      
      // Before maturity
      expect(await staking.getReward(user1.address, 0)).to.equal(0);
      
      await time.increase(TERM_6M);
      
      // After maturity
      expect(await staking.getReward(user1.address, 0)).to.equal(REWARD_6M);
      
      // After claim
      await staking.connect(user1).claim(0);
      expect(await staking.getReward(user1.address, 0)).to.equal(0);
    });

    it("Should handle invalid view queries", async function () {
      const { user1, staking } = await loadFixture(deployFixture);
      
      await expect(staking.getStake(user1.address, 999))
        .to.be.revertedWithCustomError(staking, "InvalidStake");
        
      expect(await staking.getReward(user1.address, 999)).to.equal(0);
    });
  });

  describe("7. Edge Cases", function () {
    it("Should handle multiple users correctly", async function () {
      const { user1, user2, usdc, staking } = await loadFixture(deployFixture);
      
      await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT);
      await usdc.connect(user2).approve(await staking.getAddress(), DEPOSIT_AMOUNT);
      
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_3M);
      await staking.connect(user2).deposit(DEPOSIT_AMOUNT, TERM_6M);
      
      expect(await staking.userStakeCount(user1.address)).to.equal(1);
      expect(await staking.userStakeCount(user2.address)).to.equal(1);
      
      const stake1 = await staking.getStake(user1.address, 0);
      const stake2 = await staking.getStake(user2.address, 0);
      
      expect(stake1.rate).to.equal(25);
      expect(stake2.rate).to.equal(125);
    });

    it("Should handle large numbers of stakes", async function () {
      const { user1, usdc, staking } = await loadFixture(deployFixture);
      
      const stakeCount = 10;
      await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT * BigInt(stakeCount));
      
      for(let i = 0; i < stakeCount; i++) {
        await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_3M);
      }
      
      expect(await staking.userStakeCount(user1.address)).to.equal(stakeCount);
      
      const allStakes = await staking.getStakes(user1.address);
      expect(allStakes).to.have.length(stakeCount);
      
      for(let i = 0; i < stakeCount; i++) {
        expect(allStakes[i].amount).to.equal(DEPOSIT_AMOUNT);
        expect(allStakes[i].rate).to.equal(25);
      }
    });

    it("Should maintain consistency after rate changes", async function () {
      const { deployer, user1, usdc, staking } = await loadFixture(deployFixture);
      
      // Deposit with old rate
      await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT * 2n);
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_3M);
      
      // Change rate
      await staking.connect(deployer).setTermRate(TERM_3M, 500);
      
      // Deposit with new rate
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_3M);
      
      await time.increase(TERM_3M);
      
      // Old stake should use old rate
      const balance1 = await usdc.balanceOf(user1.address);
      await staking.connect(user1).claim(0);
      expect(await usdc.balanceOf(user1.address) - balance1).to.equal(REWARD_3M);
      
      // New stake should use new rate
      const balance2 = await usdc.balanceOf(user1.address);
      await staking.connect(user1).claim(1);
      const newReward = DEPOSIT_AMOUNT * 500n / 10000n; // 5%
      expect(await usdc.balanceOf(user1.address) - balance2).to.equal(newReward);
    });
  });
});