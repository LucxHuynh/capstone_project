import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { StakingContract, MyToken } from "../typechain";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import "@nomicfoundation/hardhat-chai-matchers";

describe("StakingContract", function () {
  // Constants
  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const STAKE_AMOUNT = ethers.parseEther("1000");
  const TERM_3_MONTHS = 90 * 24 * 60 * 60;
  const TERM_6_MONTHS = 180 * 24 * 60 * 60;
  const TERM_12_MONTHS = 365 * 24 * 60 * 60;

  // Fixtures
  async function deployFixture() {
    const [deployer, user1, user2] = await ethers.getSigners();
    
    // Deploy token
    const TokenFactory = await ethers.getContractFactory("MyToken");
    const token = await TokenFactory.deploy("USD Coin", "USDC", INITIAL_SUPPLY);
    
    // Deploy staking contract
    const StakingFactory = await ethers.getContractFactory("StakingContract");
    const staking = await StakingFactory.deploy(await token.getAddress());
    
    // Setup balances
    await token.transfer(user1.address, ethers.parseEther("10000"));
    await token.transfer(user2.address, ethers.parseEther("10000"));
    await token.transfer(await staking.getAddress(), ethers.parseEther("100000"));
    
    return { deployer, user1, user2, token, staking };
  }

  async function depositFixture() {
    const fixture = await deployFixture();
    const { user1, token, staking } = fixture;
    
    // User1 makes a deposit
    await token.connect(user1).approve(await staking.getAddress(), STAKE_AMOUNT);
    await staking.connect(user1).deposit(STAKE_AMOUNT, TERM_3_MONTHS);
    
    return { ...fixture, stakeId: 0 };
  }

  describe("Deployment", function () {
    it("Should set correct parameters", async function () {
      const { deployer, token, staking } = await loadFixture(deployFixture);
      
      expect(await staking.stakingToken()).to.equal(await token.getAddress());
      expect(await staking.owner()).to.equal(deployer.address);
      
      // Check constants
      expect(await staking.TERM_3_MONTHS()).to.equal(BigInt(TERM_3_MONTHS));
      expect(await staking.TERM_6_MONTHS()).to.equal(BigInt(TERM_6_MONTHS));
      expect(await staking.TERM_12_MONTHS()).to.equal(BigInt(TERM_12_MONTHS));
      
      expect(await staking.INTEREST_3_MONTHS()).to.equal(BigInt(100));
      expect(await staking.INTEREST_6_MONTHS()).to.equal(BigInt(250));
      expect(await staking.INTEREST_12_MONTHS()).to.equal(BigInt(600));
    });
  });

  describe("Deposit", function () {
    it("Should allow valid deposits", async function () {
      const { user1, token, staking } = await loadFixture(deployFixture);
      
      await token.connect(user1).approve(await staking.getAddress(), STAKE_AMOUNT);
      
      await expect(staking.connect(user1).deposit(STAKE_AMOUNT, TERM_3_MONTHS))
        .to.emit(staking, "Deposited")
        .withArgs(user1.address, 0, STAKE_AMOUNT, TERM_3_MONTHS, 100);
      
      const stake = await staking.getUserStake(user1.address, 0);
      expect(stake.amount).to.equal(STAKE_AMOUNT);
      expect(stake.interestRate).to.equal(BigInt(100));
    });

    it("Should reject invalid inputs", async function () {
      const { user1, staking } = await loadFixture(deployFixture);
      
      // Zero amount
      await expect(staking.connect(user1).deposit(0, TERM_3_MONTHS))
        .to.be.revertedWithCustomError(staking, "InvalidAmount");
      
      // Invalid term
      await expect(staking.connect(user1).deposit(STAKE_AMOUNT, 30 * 24 * 60 * 60))
        .to.be.revertedWithCustomError(staking, "InvalidTerm");
    });
  });

  describe("Claim", function () {
    it("Should reject early claims", async function () {
      const { user1, staking, stakeId } = await loadFixture(depositFixture);
      
      await expect(staking.connect(user1).claim(stakeId))
        .to.be.revertedWithCustomError(staking, "TermNotCompleted");
    });

    it("Should allow claims after term completion", async function () {
      const { user1, token, staking, stakeId } = await loadFixture(depositFixture);
      
      await time.increase(TERM_3_MONTHS);
      
      const initialBalance = await token.balanceOf(user1.address);
      
      await expect(staking.connect(user1).claim(stakeId))
        .to.emit(staking, "RewardClaimed");
      
      const finalBalance = await token.balanceOf(user1.address);
      expect(finalBalance).to.be.gt(initialBalance);
    });
  });

  describe("Withdraw", function () {
    it("Should handle early withdrawal with penalty", async function () {
      const { user1, token, staking, stakeId } = await loadFixture(depositFixture);
      
      const initialBalance = await token.balanceOf(user1.address);
      
      await expect(staking.connect(user1).withdraw(stakeId))
        .to.emit(staking, "Withdrawn");
      
      const finalBalance = await token.balanceOf(user1.address);
      const received = finalBalance - initialBalance;
      
      // 1% penalty
      const expectedAmount = STAKE_AMOUNT - (STAKE_AMOUNT * 100n / 10000n);
      expect(received).to.equal(expectedAmount);
    });

    it("Should handle withdrawal after term with rewards", async function () {
      const { user1, token, staking } = await loadFixture(deployFixture);
      
      // Fresh deposit
      await token.connect(user1).approve(await staking.getAddress(), STAKE_AMOUNT);
      await staking.connect(user1).deposit(STAKE_AMOUNT, TERM_6_MONTHS);
      
      await time.increase(TERM_6_MONTHS);
      
      const initialBalance = await token.balanceOf(user1.address);
      await staking.connect(user1).withdraw(0);
      const finalBalance = await token.balanceOf(user1.address);
      
      expect(finalBalance - initialBalance).to.be.gt(STAKE_AMOUNT);
    });

    it("Should reject withdrawal of already withdrawn stake", async function () {
      const { user1, staking, stakeId } = await loadFixture(depositFixture);
      
      await staking.connect(user1).withdraw(stakeId);
      
      await expect(staking.connect(user1).withdraw(stakeId))
        .to.be.revertedWithCustomError(staking, "StakeAlreadyWithdrawn");
    });
  });

  describe("Emergency Withdraw", function () {
    it("Should allow owner emergency withdraw", async function () {
      const { deployer, token, staking } = await loadFixture(deployFixture);
      
      const amount = ethers.parseEther("1000");
      const initialBalance = await token.balanceOf(deployer.address);
      
      await expect(staking.connect(deployer).emergencyWithdraw(amount))
        .to.emit(staking, "EmergencyWithdraw")
        .withArgs(deployer.address, amount);
      
      const finalBalance = await token.balanceOf(deployer.address);
      expect(finalBalance - initialBalance).to.equal(amount);
    });

    it("Should reject non-owner emergency withdraw", async function () {
      const { user1, staking } = await loadFixture(deployFixture);
      
      await expect(staking.connect(user1).emergencyWithdraw(ethers.parseEther("1000")))
        .to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount");
    });
  });

  describe("View Functions", function () {
    it("Should calculate rewards correctly", async function () {
      const { staking } = await loadFixture(deployFixture);
      
      const amount = ethers.parseEther("1000");
      const interestRate = 250;
      const term = TERM_6_MONTHS;
      
      const expectedReward = (amount * BigInt(interestRate) * BigInt(term)) / (10000n * BigInt(365 * 24 * 60 * 60));
      const calculatedReward = await staking.calculateReward(amount, interestRate, term);
      
      expect(calculatedReward).to.equal(expectedReward);
    });

    it("Should validate terms correctly", async function () {
      const { staking } = await loadFixture(deployFixture);
      
      expect(await staking.isValidTerm(TERM_3_MONTHS)).to.be.true;
      expect(await staking.isValidTerm(TERM_6_MONTHS)).to.be.true;
      expect(await staking.isValidTerm(TERM_12_MONTHS)).to.be.true;
      expect(await staking.isValidTerm(30 * 24 * 60 * 60)).to.be.false;
    });

    it("Should return correct interest rates", async function () {
      const { staking } = await loadFixture(deployFixture);
      
      expect(await staking.getInterestRate(TERM_3_MONTHS)).to.equal(BigInt(100));
      expect(await staking.getInterestRate(TERM_6_MONTHS)).to.equal(BigInt(250));
      expect(await staking.getInterestRate(TERM_12_MONTHS)).to.equal(BigInt(600));
    });

    it("Should handle invalid stake IDs", async function () {
      const { user1, staking } = await loadFixture(deployFixture);
      
      await expect(staking.getUserStake(user1.address, 999))
        .to.be.revertedWithCustomError(staking, "InvalidStakeId");
    });
  });
});