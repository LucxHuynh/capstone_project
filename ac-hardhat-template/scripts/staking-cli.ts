import { ethers } from "hardhat";
import { StakingContract, MyToken } from "../typechain";
import readline from "readline";

interface ContractAddresses {
  token: string;
  staking: string;
}

class StakingCLI {
  private rl: readline.Interface;
  private token!: MyToken;
  private staking!: StakingContract;
  private signer!: any;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async initialize() {
    console.log("🚀 Staking Contract CLI");
    console.log("=".repeat(40));

    // Get contract addresses
    const addresses = await this.getContractAddresses();
    
    // Get signer
    const signers = await ethers.getSigners();
    this.signer = signers[0];
    console.log("👤 Account:", this.signer.address);

    // Connect to contracts
    this.token = await ethers.getContractAt("MyToken", addresses.token);
    this.staking = await ethers.getContractAt("StakingContract", addresses.staking);

    console.log("✅ Connected");
    console.log("📄 Token:", addresses.token);
    console.log("📄 Staking:", addresses.staking);
    console.log("");
  }

  private async getContractAddresses(): Promise<ContractAddresses> {
    try {
      const { deployments } = require("hardhat");
      const tokenDeployment = await deployments.get("MyToken");
      const stakingDeployment = await deployments.get("StakingContract");
      
      return {
        token: tokenDeployment.address,
        staking: stakingDeployment.address,
      };
    } catch {
      console.log("📝 Enter contract addresses:");
      const token = await this.question("Token address: ");
      const staking = await this.question("Staking address: ");
      return { token, staking };
    }
  }

  private question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  async showMenu() {
    console.log("\n📋 Commands:");
    console.log("1. Check balances");
    console.log("2. View staking rates");
    console.log("3. Deposit tokens");
    console.log("4. View my stakes");
    console.log("5. Claim rewards");
    console.log("6. Withdraw stake");
    console.log("7. Approve tokens");
    console.log("8. Emergency withdraw (owner)");
    console.log("0. Exit");

    const choice = await this.question("\nChoose (0-8): ");
    await this.handleChoice(choice);
  }

  private async handleChoice(choice: string) {
    try {
      switch (choice) {
        case "1": await this.checkBalances(); break;
        case "2": await this.viewRates(); break;
        case "3": await this.depositTokens(); break;
        case "4": await this.viewMyStakes(); break;
        case "5": await this.claimRewards(); break;
        case "6": await this.withdrawStake(); break;
        case "7": await this.approveTokens(); break;
        case "8": await this.emergencyWithdraw(); break;
        case "0":
          console.log("👋 Goodbye!");
          this.rl.close();
          return;
        default:
          console.log("❌ Invalid option");
      }
    } catch (error: any) {
      console.log("❌ Error:", error.message);
    }

    await this.showMenu();
  }

  private async checkBalances() {
    console.log("\n💰 Balances:");
    
    const tokenBalance = await this.token.balanceOf(this.signer.address);
    const allowance = await this.token.allowance(this.signer.address, await this.staking.getAddress());
    const stakeCount = await this.staking.userStakeCount(this.signer.address);

    console.log("Your tokens:", ethers.formatEther(tokenBalance), "USDC");
    console.log("Allowance:", ethers.formatEther(allowance), "USDC");
    console.log("Total stakes:", stakeCount.toString());
  }

  private async viewRates() {
    console.log("\n📊 Staking Rates:");
    
    const terms = {
      "3 months": Number(await this.staking.TERM_3_MONTHS()) / (24 * 60 * 60),
      "6 months": Number(await this.staking.TERM_6_MONTHS()) / (24 * 60 * 60),
      "12 months": Number(await this.staking.TERM_12_MONTHS()) / (24 * 60 * 60),
    };

    const rates = {
      "3 months": Number(await this.staking.RATE_3_MONTHS()) / 100,
      "6 months": Number(await this.staking.RATE_6_MONTHS()) / 100,
      "12 months": Number(await this.staking.RATE_12_MONTHS()) / 100,
    };

    console.log("Term         | Days | Rate | APY");
    console.log("-------------|------|------|-----");
    Object.keys(terms).forEach((term) => {
      const days = terms[term as keyof typeof terms];
      const rate = rates[term as keyof typeof rates];
      const apy = rate * (365 / days);
      console.log(`${term.padEnd(12)} | ${days.toString().padEnd(4)} | ${rate}% | ${apy.toFixed(1)}%`);
    });

    console.log("\nPenalty for early withdrawal: 1%");
  }

  private async depositTokens() {
    console.log("\n💳 Deposit Tokens:");
    
    const amount = await this.question("Amount to stake: ");
    const termChoice = await this.question("Term (3/6/12 months): ");
    
    let termSeconds: number;
    switch (termChoice) {
      case "3":
        termSeconds = Number(await this.staking.TERM_3_MONTHS());
        break;
      case "6":
        termSeconds = Number(await this.staking.TERM_6_MONTHS());
        break;
      case "12":
        termSeconds = Number(await this.staking.TERM_12_MONTHS());
        break;
      default:
        throw new Error("Invalid term. Choose 3, 6, or 12");
    }

    const amountWei = ethers.parseEther(amount);
    
    // Check allowance
    const allowance = await this.token.allowance(this.signer.address, await this.staking.getAddress());
    if (allowance < amountWei) {
      console.log("⚠️ Insufficient allowance. Run option 7 to approve first.");
      return;
    }

    console.log("🔄 Depositing...");
    const tx = await this.staking.deposit(amountWei, termSeconds);
    await tx.wait();
    
    console.log("✅ Deposit successful!");
    console.log("📄 TX:", tx.hash);

    // Show expected reward
    const rate = termChoice === "3" ? 1 : termChoice === "6" ? 2.5 : 6;
    const expectedReward = parseFloat(amount) * (rate / 100);
    console.log(`💰 Expected reward: ${expectedReward} USDC after ${termChoice} months`);
  }

  private async viewMyStakes() {
    console.log("\n📈 Your Stakes:");
    
    const stakeCount = await this.staking.userStakeCount(this.signer.address);
    
    if (stakeCount === 0n) {
      console.log("No stakes found");
      return;
    }

    console.log("\nID | Amount | Rate | End Date   | Status    | Reward");
    console.log("---|--------|------|------------|-----------|-------");

    for (let i = 0; i < Number(stakeCount); i++) {
      try {
        const stake = await this.staking.getStake(this.signer.address, i);
        
        const endDate = new Date(Number(stake.endTime) * 1000);
        const now = new Date();
        const isCompleted = now >= endDate;
        const isWithdrawn = stake.withdrawn;

        let status = "Active";
        if (isWithdrawn) status = "Withdrawn";
        else if (isCompleted) status = "Ready";

        const amount = ethers.formatEther(stake.amount);
        const rate = Number(stake.rate) / 100;
        const endDateStr = endDate.toLocaleDateString();
        const claimed = ethers.formatEther(stake.rewardClaimed);

        let availableReward = "0";
        if (!isWithdrawn && isCompleted) {
          const reward = await this.staking.getReward(this.signer.address, i);
          availableReward = ethers.formatEther(reward);
        }

        console.log(`${i.toString().padEnd(2)} | ${amount.padEnd(6)} | ${rate}% | ${endDateStr} | ${status.padEnd(9)} | ${availableReward}`);
      } catch (error) {
        console.log(`${i} | Error reading stake`);
      }
    }
  }

  private async claimRewards() {
    console.log("\n🎁 Claim Rewards:");
    
    const stakeId = await this.question("Stake ID to claim: ");
    
    // Check if claimable
    const reward = await this.staking.getReward(this.signer.address, parseInt(stakeId));
    if (reward === 0n) {
      console.log("❌ No rewards available for this stake");
      return;
    }

    console.log(`💰 Available reward: ${ethers.formatEther(reward)} USDC`);
    const confirm = await this.question("Confirm claim? (y/N): ");
    
    if (confirm.toLowerCase() !== 'y') {
      console.log("❌ Cancelled");
      return;
    }

    console.log("🔄 Claiming...");
    const tx = await this.staking.claim(parseInt(stakeId));
    await tx.wait();
    
    console.log("✅ Rewards claimed!");
    console.log("📄 TX:", tx.hash);
  }

  private async withdrawStake() {
    console.log("\n💸 Withdraw Stake:");
    
    const stakeId = await this.question("Stake ID to withdraw: ");
    
    // Get stake info
    const stake = await this.staking.getStake(this.signer.address, parseInt(stakeId));
    const endDate = new Date(Number(stake.endTime) * 1000);
    const now = new Date();
    const isEarly = now < endDate;

    console.log(`📋 Stake info:`);
    console.log(`   Amount: ${ethers.formatEther(stake.amount)} USDC`);
    console.log(`   End date: ${endDate.toLocaleDateString()}`);
    
    if (isEarly) {
      const penalty = parseFloat(ethers.formatEther(stake.amount)) * 0.01;
      const received = parseFloat(ethers.formatEther(stake.amount)) - penalty;
      console.log(`⚠️ EARLY WITHDRAWAL`);
      console.log(`   Penalty: ${penalty} USDC (1%)`);
      console.log(`   You'll receive: ${received} USDC`);
    } else {
      const reward = await this.staking.getReward(this.signer.address, parseInt(stakeId));
      const total = parseFloat(ethers.formatEther(stake.amount)) + parseFloat(ethers.formatEther(reward));
      console.log(`✅ NORMAL WITHDRAWAL`);
      console.log(`   Reward: ${ethers.formatEther(reward)} USDC`);
      console.log(`   Total: ${total} USDC`);
    }

    const confirm = await this.question("Confirm withdrawal? (y/N): ");
    
    if (confirm.toLowerCase() !== 'y') {
      console.log("❌ Cancelled");
      return;
    }

    console.log("🔄 Withdrawing...");
    const tx = await this.staking.withdraw(parseInt(stakeId));
    await tx.wait();
    
    console.log("✅ Withdrawal successful!");
    console.log("📄 TX:", tx.hash);
  }

  private async approveTokens() {
    console.log("\n✅ Approve Tokens:");
    
    const amount = await this.question("Amount to approve (or 'max'): ");
    const amountWei = amount === "max" 
      ? ethers.MaxUint256 
      : ethers.parseEther(amount);
    
    console.log("🔄 Approving...");
    const tx = await this.token.approve(await this.staking.getAddress(), amountWei);
    await tx.wait();
    
    console.log("✅ Approval successful!");
    console.log("📄 TX:", tx.hash);
  }

  private async emergencyWithdraw() {
    console.log("\n🚨 Emergency Withdraw (Owner Only):");
    
    const amount = await this.question("Amount to withdraw: ");
    const amountWei = ethers.parseEther(amount);
    
    console.log("⚠️ This is for emergency situations only!");
    const confirm = await this.question("Are you sure? (y/N): ");
    
    if (confirm.toLowerCase() !== 'y') {
      console.log("❌ Cancelled");
      return;
    }

    console.log("🔄 Emergency withdrawing...");
    const tx = await this.staking.emergencyWithdraw(amountWei);
    await tx.wait();
    
    console.log("✅ Emergency withdrawal successful!");
    console.log("📄 TX:", tx.hash);
  }

  async run() {
    try {
      await this.initialize();
      await this.showMenu();
    } catch (error: any) {
      console.log("❌ Fatal error:", error.message);
      this.rl.close();
    }
  }
}

// Main execution
async function main() {
  const cli = new StakingCLI();
  await cli.run();
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exitCode = 1;
});