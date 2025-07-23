import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { StakingContract, MyToken } from "../typechain";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import "@nomicfoundation/hardhat-chai-matchers";

describe("StakingContract Logic Validation", function () {
  // Constants
  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const DEPOSIT_AMOUNT = ethers.parseEther("1000");
  const TERM_3_MONTHS = 90 * 24 * 60 * 60;
  const TERM_6_MONTHS = 180 * 24 * 60 * 60;
  const TERM_12_MONTHS = 365 * 24 * 60 * 60;

  // Expected values (ĐÚNG LOGIC)
  const EXPECTED_REWARD_3M = ethers.parseEther("10");    // 1000 * 1% = 10 USDC
  const EXPECTED_REWARD_6M = ethers.parseEther("25");    // 1000 * 2.5% = 25 USDC
  const EXPECTED_REWARD_12M = ethers.parseEther("60");   // 1000 * 6% = 60 USDC
  const EXPECTED_PENALTY = ethers.parseEther("10");      // 1000 * 1% = 10 USDC

  // Fixtures
  async function deployFixture() {
    const [deployer, user1, user2] = await ethers.getSigners();
    
    // Deploy USDC token
    const TokenFactory = await ethers.getContractFactory("MyToken");
    const usdc = await TokenFactory.deploy("USD Coin", "USDC", INITIAL_SUPPLY);
    
    // Deploy staking contract
    const StakingFactory = await ethers.getContractFactory("StakingContract");
    const staking = await StakingFactory.deploy(await usdc.getAddress());
    
    // Setup balances
    await usdc.transfer(user1.address, ethers.parseEther("10000"));
    await usdc.transfer(user2.address, ethers.parseEther("10000"));
    // Contract needs rewards fund
    await usdc.transfer(await staking.getAddress(), ethers.parseEther("100000"));
    
    return { deployer, user1, user2, usdc, staking };
  }

  describe("1. Token Integration", function () {
    it("Should use USDC as staking token", async function () {
      const { usdc, staking } = await loadFixture(deployFixture);
      
      expect(await staking.stakingToken()).to.equal(await usdc.getAddress());
    });

    it("Should have correct token decimals and symbol", async function () {
      const { usdc } = await loadFixture(deployFixture);
      
      expect(await usdc.symbol()).to.equal("USDC");
      expect(await usdc.decimals()).to.equal(18);
    });
  });

  describe("2. Deposit Function Tests", function () {
    it("Should accept deposit with valid terms", async function () {
      const { user1, usdc, staking } = await loadFixture(deployFixture);
      
      await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT);
      
      // Test all valid terms
      await expect(staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_3_MONTHS))
        .to.emit(staking, "Deposited")
        .withArgs(user1.address, 0, DEPOSIT_AMOUNT, TERM_3_MONTHS);
      
      const stake = await staking.getStake(user1.address, 0);
      expect(stake.amount).to.equal(DEPOSIT_AMOUNT);
      expect(stake.rate).to.equal(100); // 1% for 3 months
    });

    it("Should reject invalid terms", async function () {
      const { user1, usdc, staking } = await loadFixture(deployFixture);
      
      await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT);
      
      // Invalid terms should fail
      await expect(staking.connect(user1).deposit(DEPOSIT_AMOUNT, 30 * 24 * 60 * 60))
        .to.be.revertedWithCustomError(staking, "InvalidInput");
      
      await expect(staking.connect(user1).deposit(DEPOSIT_AMOUNT, 120 * 24 * 60 * 60))
        .to.be.revertedWithCustomError(staking, "InvalidInput");
    });

    it("Should reject zero deposit", async function () {
      const { user1, staking } = await loadFixture(deployFixture);
      
      await expect(staking.connect(user1).deposit(0, TERM_3_MONTHS))
        .to.be.revertedWithCustomError(staking, "InvalidInput");
    });

    it("Should correctly set interest rates for different terms", async function () {
      const { user1, usdc, staking } = await loadFixture(deployFixture);
      
      await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT * 3n);
      
      // Deposit with different terms
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_3_MONTHS);
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_6_MONTHS);
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_12_MONTHS);
      
      const stake3m = await staking.getStake(user1.address, 0);
      const stake6m = await staking.getStake(user1.address, 1);
      const stake12m = await staking.getStake(user1.address, 2);
      
      // Verify interest rates
      expect(stake3m.rate).to.equal(100);  // 1%
      expect(stake6m.rate).to.equal(250);  // 2.5%
      expect(stake12m.rate).to.equal(600); // 6%
    });
  });

  describe("3. Claim Function Tests", function () {
    it("Should reject early claims", async function () {
      const { user1, usdc, staking } = await loadFixture(deployFixture);
      
      await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT);
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_3_MONTHS);
      
      // Should fail before term ends
      await expect(staking.connect(user1).claim(0))
        .to.be.revertedWithCustomError(staking, "NotReady");
    });

    it("Should calculate correct rewards after term completion", async function () {
      const { user1, usdc, staking } = await loadFixture(deployFixture);
      
      await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT * 3n);
      
      // Test all terms
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_3_MONTHS);
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_6_MONTHS);
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_12_MONTHS);
      
      // Fast forward to longest term completion
      await time.increase(TERM_12_MONTHS);
      
      // Check 3-month reward: 1000 * 1% = 10 USDC
      const balanceBefore3m = await usdc.balanceOf(user1.address);
      await staking.connect(user1).claim(0);
      const balanceAfter3m = await usdc.balanceOf(user1.address);
      const reward3m = balanceAfter3m - balanceBefore3m;
      
      console.log("3-month reward:", ethers.formatEther(reward3m), "USDC");
      expect(reward3m).to.equal(EXPECTED_REWARD_3M, "3-month reward should be 10 USDC");
      
      // Check 6-month reward: 1000 * 2.5% = 25 USDC
      const balanceBefore6m = await usdc.balanceOf(user1.address);
      await staking.connect(user1).claim(1);
      const balanceAfter6m = await usdc.balanceOf(user1.address);
      const reward6m = balanceAfter6m - balanceBefore6m;
      
      console.log("6-month reward:", ethers.formatEther(reward6m), "USDC");
      expect(reward6m).to.equal(EXPECTED_REWARD_6M, "6-month reward should be 25 USDC");
      
      // Check 12-month reward: 1000 * 6% = 60 USDC
      const balanceBefore12m = await usdc.balanceOf(user1.address);
      await staking.connect(user1).claim(2);
      const balanceAfter12m = await usdc.balanceOf(user1.address);
      const reward12m = balanceAfter12m - balanceBefore12m;
      
      console.log("12-month reward:", ethers.formatEther(reward12m), "USDC");
      expect(reward12m).to.equal(EXPECTED_REWARD_12M, "12-month reward should be 60 USDC");
    });

    it("Should prevent double claiming", async function () {
      const { user1, usdc, staking } = await loadFixture(deployFixture);
      
      await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT);
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_3_MONTHS);
      
      await time.increase(TERM_3_MONTHS);
      
      // First claim should work
      await staking.connect(user1).claim(0);
      
      // Second claim should fail
      await expect(staking.connect(user1).claim(0))
        .to.be.revertedWithCustomError(staking, "InvalidInput");
    });
  });

  describe("4. Withdraw Function Tests", function () {
    describe("Early Withdrawal (with penalty)", function () {
      it("Should apply 1% penalty for early withdrawal", async function () {
        const { user1, usdc, staking } = await loadFixture(deployFixture);
        
        await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT);
        await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_3_MONTHS);
        
        const balanceBefore = await usdc.balanceOf(user1.address);
        
        // Early withdrawal
        await staking.connect(user1).withdraw(0);
        
        const balanceAfter = await usdc.balanceOf(user1.address);
        const received = balanceAfter - balanceBefore;
        
        // Expected: 1000 - (1000 * 1%) = 990 USDC
        const expectedReceived = DEPOSIT_AMOUNT - EXPECTED_PENALTY;
        
        console.log("Early withdrawal received:", ethers.formatEther(received), "USDC");
        console.log("Expected:", ethers.formatEther(expectedReceived), "USDC");
        
        expect(received).to.equal(expectedReceived, "Should receive 990 USDC after 1% penalty");
      });

      it("Should not give rewards for early withdrawal", async function () {
        const { user1, usdc, staking } = await loadFixture(deployFixture);
        
        await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT);
        await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_6_MONTHS);
        
        // Wait 3 months (half term)
        await time.increase(TERM_3_MONTHS);
        
        const balanceBefore = await usdc.balanceOf(user1.address);
        await staking.connect(user1).withdraw(0);
        const balanceAfter = await usdc.balanceOf(user1.address);
        
        const received = balanceAfter - balanceBefore;
        const expectedReceived = DEPOSIT_AMOUNT - EXPECTED_PENALTY;
        
        expect(received).to.equal(expectedReceived, "Early withdrawal should not include any rewards");
      });
    });

    describe("Normal Withdrawal (after term)", function () {
      it("Should return principal + full reward after term completion", async function () {
        const { user1, usdc, staking } = await loadFixture(deployFixture);
        
        await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT);
        await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_6_MONTHS);
        
        await time.increase(TERM_6_MONTHS);
        
        const balanceBefore = await usdc.balanceOf(user1.address);
        await staking.connect(user1).withdraw(0);
        const balanceAfter = await usdc.balanceOf(user1.address);
        
        const received = balanceAfter - balanceBefore;
        // Expected: 1000 + (1000 * 2.5%) = 1025 USDC
        const expectedReceived = DEPOSIT_AMOUNT + EXPECTED_REWARD_6M;
        
        console.log("Normal withdrawal received:", ethers.formatEther(received), "USDC");
        console.log("Expected:", ethers.formatEther(expectedReceived), "USDC");
        
        expect(received).to.equal(expectedReceived, "Should receive 1025 USDC (principal + reward)");
      });

      it("Should handle partial claim then withdraw correctly", async function () {
        const { user1, usdc, staking } = await loadFixture(deployFixture);
        
        await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT);
        await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_3_MONTHS);
        
        await time.increase(TERM_3_MONTHS);
        
        // First claim reward
        await staking.connect(user1).claim(0);
        
        // Then withdraw - should only get principal
        const balanceBefore = await usdc.balanceOf(user1.address);
        await staking.connect(user1).withdraw(0);
        const balanceAfter = await usdc.balanceOf(user1.address);
        
        const received = balanceAfter - balanceBefore;
        
        console.log("Partial claim withdrawal received:", ethers.formatEther(received), "USDC");
        expect(received).to.equal(DEPOSIT_AMOUNT, "Should only receive principal after claiming rewards");
      });
    });

    it("Should prevent double withdrawal", async function () {
      const { user1, usdc, staking } = await loadFixture(deployFixture);
      
      await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT);
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_3_MONTHS);
      
      // First withdrawal
      await staking.connect(user1).withdraw(0);
      
      // Second withdrawal should fail
      await expect(staking.connect(user1).withdraw(0))
        .to.be.revertedWithCustomError(staking, "InvalidStake");
    });
  });

  describe("5. Admin Emergency Withdraw", function () {
    it("Should allow owner to emergency withdraw", async function () {
      const { deployer, usdc, staking } = await loadFixture(deployFixture);
      
      const withdrawAmount = ethers.parseEther("1000");
      const balanceBefore = await usdc.balanceOf(deployer.address);
      
      await staking.connect(deployer).emergencyWithdraw(withdrawAmount);
      
      const balanceAfter = await usdc.balanceOf(deployer.address);
      const received = balanceAfter - balanceBefore;
      
      expect(received).to.equal(withdrawAmount, "Owner should be able to emergency withdraw");
    });

    it("Should reject non-owner emergency withdraw", async function () {
      const { user1, staking } = await loadFixture(deployFixture);
      
      await expect(staking.connect(user1).emergencyWithdraw(ethers.parseEther("1000")))
        .to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount");
    });
  });

  describe("6. Interest Rate Validation", function () {
    it("Should have correct interest rates as specified", async function () {
      const { staking } = await loadFixture(deployFixture);
      
      // Check contract constants match requirements
      expect(await staking.RATE_3_MONTHS()).to.equal(100, "3-month rate should be 1%");
      expect(await staking.RATE_6_MONTHS()).to.equal(250, "6-month rate should be 2.5%");
      expect(await staking.RATE_12_MONTHS()).to.equal(600, "12-month rate should be 6%");
      expect(await staking.PENALTY_RATE()).to.equal(100, "Penalty rate should be 1%");
    });

    it("Should demonstrate correct APY calculations", async function () {
      // This shows what APY the fixed rates represent
      const principal = ethers.parseEther("1000");
      
      // 3 months: 1% for 3 months = 4% APY
      const reward3m = principal * 100n / 10000n; // 10 USDC
      const apy3m = reward3m * 4n; // 40 USDC = 4% APY
      
      // 6 months: 2.5% for 6 months = 5% APY  
      const reward6m = principal * 250n / 10000n; // 25 USDC
      const apy6m = reward6m * 2n; // 50 USDC = 5% APY
      
      // 12 months: 6% for 12 months = 6% APY
      const reward12m = principal * 600n / 10000n; // 60 USDC = 6% APY
      const apy12m = reward12m * 1n; // ✅ Sửa: 60 USDC = 6% APY (không nhân thêm)
      
      console.log("\n🔍 Interest Rate Analysis:");
      console.log("3-month: 1% return =", ethers.formatEther(apy3m), "USDC APY (4%)");
      console.log("6-month: 2.5% return =", ethers.formatEther(apy6m), "USDC APY (5%)");
      console.log("12-month: 6% return =", ethers.formatEther(apy12m), "USDC APY (6%)");
      
      expect(apy3m).to.equal(ethers.parseEther("40"));
      expect(apy6m).to.equal(ethers.parseEther("50"));
      expect(apy12m).to.equal(ethers.parseEther("60")); // ✅ Bây giờ đúng
    });
  });

  describe("7. Edge Cases & Error Handling", function () {
    it("Should handle invalid stake IDs", async function () {
      const { user1, staking } = await loadFixture(deployFixture);
      
      await expect(staking.getStake(user1.address, 999))
        .to.be.revertedWithCustomError(staking, "InvalidStake");
      
      await expect(staking.connect(user1).claim(999))
        .to.be.revertedWithCustomError(staking, "InvalidStake");
      
      await expect(staking.connect(user1).withdraw(999))
        .to.be.revertedWithCustomError(staking, "InvalidStake");
    });

    it("Should handle multiple stakes correctly", async function () {
      const { user1, usdc, staking } = await loadFixture(deployFixture);
      
      await usdc.connect(user1).approve(await staking.getAddress(), DEPOSIT_AMOUNT * 3n);
      
      // Multiple deposits
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_3_MONTHS);
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_6_MONTHS);
      await staking.connect(user1).deposit(DEPOSIT_AMOUNT, TERM_12_MONTHS);
      
      expect(await staking.userStakeCount(user1.address)).to.equal(3);
      
      const stakes = await staking.getStakes(user1.address);
      expect(stakes.length).to.equal(3);
      expect(stakes[0].rate).to.equal(100);
      expect(stakes[1].rate).to.equal(250);
      expect(stakes[2].rate).to.equal(600);
    });
  });
});