import { ethers } from "hardhat";
import readline from "readline";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (prompt: string): Promise<string> => new Promise(resolve => rl.question(prompt, resolve));

async function main() {
  console.log("🚀 Staking CLI\n");

  const [signer] = await ethers.getSigners();
  console.log("👤 Account:", signer.address);

  let token: any, staking: any;

  // Try to connect to deployed contracts first
  try {
    const { deployments } = require("hardhat");
    const tokenDep = await deployments.get("MyToken");
    const stakingDep = await deployments.get("StakingContract");
    
    token = await ethers.getContractAt("MyToken", tokenDep.address);
    staking = await ethers.getContractAt("StakingContract", stakingDep.address);
    
    console.log("📄 Connected to deployed contracts:");
    console.log("   Token:", tokenDep.address);
    console.log("   Staking:", stakingDep.address);
    console.log("");
    
  } catch {
    // Fallback: Quick deploy for testing
    console.log("📦 No deployed contracts found. Deploying new ones...");
    
    const TokenFactory = await ethers.getContractFactory("MyToken");
    token = await TokenFactory.deploy("USDC", "USDC", ethers.parseEther("1000000"));
    await token.waitForDeployment();
    
    const StakingFactory = await ethers.getContractFactory("StakingContract");
    staking = await StakingFactory.deploy(await token.getAddress());
    await staking.waitForDeployment();
    
    // Setup balances
    await token.transfer(signer.address, ethers.parseEther("10000"));
    await token.transfer(await staking.getAddress(), ethers.parseEther("100000"));
    
    console.log("✅ New contracts deployed!\n");
  }

  const isOwner = (await staking.owner()).toLowerCase() === signer.address.toLowerCase();

  while (true) {
    console.log("📋 Menu:");
    console.log("1. Deposit  2. View Stakes  3. Withdraw  4. Claim");
    if (isOwner) console.log("5. Admin");
    console.log("0. Exit");

    const choice = await question("Choose: ");

    try {
      if (choice === "1") await deposit(token, staking, signer);
      else if (choice === "2") await viewStakes(staking, signer);
      else if (choice === "3") await withdraw(staking, signer);
      else if (choice === "4") await claim(staking, signer);
      else if (choice === "5" && isOwner) await admin(staking, token, signer);
      else if (choice === "0") break;
      else console.log("❌ Invalid choice");
    } catch (error: any) {
      console.log("❌ Error:", error.message);
    }
  }

  console.log("👋 Goodbye!");
  rl.close();
}

async function deposit(token: any, staking: any, signer: any) {
  const amount = await question("Amount: ");
  const term = await question("Term (3/6/12 months): ");
  
  if (!amount || !["3", "6", "12"].includes(term)) {
    console.log("❌ Invalid input");
    return;
  }
  
  const amountWei = ethers.parseEther(amount);
  const termMap: Record<string, number> = { "3": 90, "6": 180, "12": 365 };
  const rewardMap: Record<string, number> = { "3": 0.0025, "6": 0.0125, "12": 0.06 };
  
  const termSeconds = termMap[term] * 24 * 60 * 60;
  const expectedReward = parseFloat(amount) * rewardMap[term];
  
  console.log("🔄 Processing...");
  await (await token.approve(await staking.getAddress(), amountWei)).wait();
  const tx = await staking.deposit(amountWei, termSeconds);
  await tx.wait();
  
  console.log(`✅ Deposited ${amount} USDC for ${term} months`);
  console.log(`💰 Expected reward: ${expectedReward} USDC\n`);
}

async function viewStakes(staking: any, signer: any) {
  const count = Number(await staking.userStakeCount(signer.address));
  
  if (count === 0) {
    console.log("❌ No stakes found\n");
    return;
  }
  
  console.log(`\n📈 Your ${count} stakes:`);
  
  for (let i = 0; i < count; i++) {
    const stake = await staking.getStake(signer.address, i);
    const endDate = new Date(Number(stake.endTime) * 1000);
    const isReady = Date.now() >= Number(stake.endTime) * 1000;
    const amount = ethers.formatEther(stake.amount);
    const rate = Number(stake.rate) / 100;
    
    console.log(`\n[${i}] ${amount} USDC at ${rate}%`);
    console.log(`    End: ${endDate.toLocaleDateString()}`);
    
    if (stake.withdrawn) {
      console.log(`    Status: WITHDRAWN ✅`);
    } else if (isReady) {
      const reward = ethers.formatEther(await staking.getReward(signer.address, i));
      console.log(`    Status: READY 🎉 (${reward} USDC reward)`);
    } else {
      const penaltyRate = Number(await staking.PENALTY_RATE()) / 100;
      console.log(`    Status: LOCKED ⏳ (${penaltyRate}% penalty if early)`);
    }
  }
  console.log();
}

async function withdraw(staking: any, signer: any) {
  const count = Number(await staking.userStakeCount(signer.address));
  if (count === 0) {
    console.log("❌ No stakes found\n");
    return;
  }
  
  // Show available stakes
  console.log("\n📤 Available stakes:");
  for (let i = 0; i < count; i++) {
    const stake = await staking.getStake(signer.address, i);
    if (stake.withdrawn) continue;
    
    const amount = ethers.formatEther(stake.amount);
    const isEarly = Date.now() < Number(stake.endTime) * 1000;
    console.log(`[${i}] ${amount} USDC - ${isEarly ? "🔒 Early" : "✅ Ready"}`);
  }
  
  const id = await question("\nStake ID: ");
  const stakeId = parseInt(id);
  
  if (isNaN(stakeId) || stakeId >= count) {
    console.log("❌ Invalid stake ID");
    return;
  }
  
  const stake = await staking.getStake(signer.address, stakeId);
  if (stake.withdrawn) {
    console.log("❌ Already withdrawn");
    return;
  }
  
  const amount = ethers.formatEther(stake.amount);
  const isEarly = Date.now() < Number(stake.endTime) * 1000;
  
  if (isEarly) {
    const penaltyRate = Number(await staking.PENALTY_RATE()) / 10000; // Fix: chia 10000 thay vì 100
    const penalty = parseFloat(amount) * penaltyRate;
    const willReceive = parseFloat(amount) - penalty;
    console.log(`⚠️ Early withdrawal: ${willReceive} USDC (${penalty} USDC penalty)`);
  } else {
    const reward = ethers.formatEther(await staking.getReward(signer.address, stakeId));
    console.log(`✅ Normal withdrawal: ${parseFloat(amount) + parseFloat(reward)} USDC total`);
  }
  
  const confirm = await question("Confirm? (y/N): ");
  if (confirm.toLowerCase() === 'y') {
    console.log("🔄 Processing...");
    const tx = await staking.withdraw(stakeId);
    await tx.wait();
    console.log("✅ Withdrawal successful!\n");
  }
}

async function claim(staking: any, signer: any) {
  const count = Number(await staking.userStakeCount(signer.address));
  if (count === 0) {
    console.log("❌ No stakes found\n");
    return;
  }
  
  // Show claimable stakes
  console.log("\n🎁 Claimable rewards:");
  let hasClaimable = false;
  
  for (let i = 0; i < count; i++) {
    const stake = await staking.getStake(signer.address, i);
    if (stake.withdrawn || Date.now() < Number(stake.endTime) * 1000) continue;
    
    const reward = await staking.getReward(signer.address, i);
    if (Number(reward) === 0) continue;
    
    hasClaimable = true;
    console.log(`[${i}] ${ethers.formatEther(reward)} USDC`);
  }
  
  if (!hasClaimable) {
    console.log("❌ No claimable rewards\n");
    return;
  }
  
  const id = await question("\nStake ID: ");
  const stakeId = parseInt(id);
  
  if (isNaN(stakeId) || stakeId >= count) {
    console.log("❌ Invalid stake ID");
    return;
  }
  
  const reward = await staking.getReward(signer.address, stakeId);
  if (Number(reward) === 0) {
    console.log("❌ No reward available");
    return;
  }
  
  console.log("🔄 Processing...");
  const tx = await staking.claim(stakeId);
  await tx.wait();
  console.log(`✅ Claimed ${ethers.formatEther(reward)} USDC!\n`);
}

async function admin(staking: any, token: any, signer: any) {
  console.log("\n🔑 Admin Menu:");
  console.log("1. View Rates  2. Set Rate  3. Set Penalty  4. Emergency Withdraw  0. Back");
  
  const choice = await question("Admin choice: ");
  
  if (choice === "1") {
    const rates = await Promise.all([
      staking.RATE_3_MONTHS(),
      staking.RATE_6_MONTHS(), 
      staking.RATE_12_MONTHS(),
      staking.PENALTY_RATE()
    ]);
    
    console.log("\n📊 Current Rates:");
    console.log(`3M: ${Number(rates[0])/100}%  6M: ${Number(rates[1])/100}%  12M: ${Number(rates[2])/100}%`);
    console.log(`Penalty: ${Number(rates[3])/100}%\n`);
    
  } else if (choice === "2") {
    const term = await question("Term (3/6/12): ");
    const rate = await question("New rate (%): ");
    
    if (!["3", "6", "12"].includes(term) || isNaN(parseFloat(rate)) || parseFloat(rate) > 50) {
      console.log("❌ Invalid input");
      return;
    }
    
    const termMap: Record<string, number> = { "3": 90, "6": 180, "12": 365 };
    const termSeconds = termMap[term] * 24 * 60 * 60;
    const rateValue = parseFloat(rate) * 100;
    
    console.log("🔄 Processing...");
    const tx = await staking.setTermRate(termSeconds, rateValue);
    await tx.wait();
    console.log(`✅ Set ${term}M rate to ${rate}%\n`);
    
  } else if (choice === "3") {
    const rate = await question("New penalty rate (%): ");
    
    if (isNaN(parseFloat(rate)) || parseFloat(rate) > 10) {
      console.log("❌ Invalid rate (max 10%)");
      return;
    }
    
    console.log("🔄 Processing...");
    const tx = await staking.setPenaltyRate(parseFloat(rate) * 100);
    await tx.wait();
    console.log(`✅ Set penalty to ${rate}%\n`);
    
  } else if (choice === "4") {
    const balance = await token.balanceOf(await staking.getAddress());
    console.log(`Contract balance: ${ethers.formatEther(balance)} USDC`);
    
    const amount = await question("Amount to withdraw: ");
    if (isNaN(parseFloat(amount))) {
      console.log("❌ Invalid amount");
      return;
    }
    
    const confirm = await question("⚠️ Emergency withdraw? (yes/no): ");
    if (confirm.toLowerCase() === 'yes') {
      console.log("🔄 Processing...");
      const tx = await staking.emergencyWithdraw(ethers.parseEther(amount));
      await tx.wait();
      console.log(`✅ Emergency withdrew ${amount} USDC\n`);
    }
  }
}

main().catch(console.error);