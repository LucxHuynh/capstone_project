import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("\n=== Deploying Staking System ===");
  console.log("Deployer:", deployer);

  // Constants
  const INITIAL_TOKEN_SUPPLY = ethers.parseEther("1000000"); // 1M tokens
  const REWARD_POOL_AMOUNT = ethers.parseEther("100000");   // 100K tokens for rewards

  // Step 1: Deploy or get existing MyToken
  let tokenAddress: string;
  let tokenDeployment;
  
  try {
    tokenDeployment = await get("MyToken");
    tokenAddress = tokenDeployment.address;
    console.log("✅ Using existing MyToken at:", tokenAddress);
  } catch {
    console.log("📦 Deploying new MyToken...");
    tokenDeployment = await deploy("MyToken", {
      from: deployer,
      args: ["USD Coin", "USDC", INITIAL_TOKEN_SUPPLY],
      log: true,
      waitConfirmations: 1,
    });
    tokenAddress = tokenDeployment.address;
    console.log("✅ MyToken deployed at:", tokenAddress);
  }

  // Step 2: Deploy StakingContract
  console.log("📦 Deploying StakingContract...");
  const stakingDeployment = await deploy("StakingContract", {
    from: deployer,
    args: [tokenAddress],
    log: true,
    waitConfirmations: 1,
  });

  console.log("✅ StakingContract deployed at:", stakingDeployment.address);

  // Step 3: Setup reward pool
  if (stakingDeployment.newlyDeployed) {
    console.log("🔧 Setting up reward pool...");
    
    const token = await ethers.getContractAt("MyToken", tokenAddress);
    const stakingContract = await ethers.getContractAt("StakingContract", stakingDeployment.address);
    
    // Check deployer balance
    const deployerBalance = await token.balanceOf(deployer);
    console.log("Deployer balance:", ethers.formatEther(deployerBalance), "tokens");
    
    if (deployerBalance >= REWARD_POOL_AMOUNT) {
      // Transfer reward tokens to staking contract
      const transferTx = await token.transfer(stakingDeployment.address, REWARD_POOL_AMOUNT);
      await transferTx.wait();
      
      const contractBalance = await stakingContract.getContractBalance();
      console.log("✅ Reward pool funded:", ethers.formatEther(contractBalance), "tokens");
    } else {
      console.log("⚠️  Insufficient balance to fund reward pool");
      console.log("Required:", ethers.formatEther(REWARD_POOL_AMOUNT));
      console.log("Available:", ethers.formatEther(deployerBalance));
    }
  }

  // Step 4: Verify deployment
  console.log("\n=== Deployment Summary ===");
  console.log("Token (USDC):", tokenAddress);
  console.log("StakingContract:", stakingDeployment.address);
  
  try {
    const stakingContract = await ethers.getContractAt("StakingContract", stakingDeployment.address);
    const contractBalance = await stakingContract.getContractBalance();
    const stakingToken = await stakingContract.stakingToken();
    const owner = await stakingContract.owner();
    
    console.log("Contract Balance:", ethers.formatEther(contractBalance), "tokens");
    console.log("Staking Token:", stakingToken);
    console.log("Owner:", owner);
    
    // Display staking terms
    console.log("\n=== Staking Terms ===");
    const term3 = await stakingContract.TERM_3_MONTHS();
    const term6 = await stakingContract.TERM_6_MONTHS();
    const term12 = await stakingContract.TERM_12_MONTHS();
    
    const interest3 = await stakingContract.INTEREST_3_MONTHS();
    const interest6 = await stakingContract.INTEREST_6_MONTHS();
    const interest12 = await stakingContract.INTEREST_12_MONTHS();
    
    console.log("3 months:", Number(term3) / (24*60*60), "days, APY:", Number(interest3)/100, "%");
    console.log("6 months:", Number(term6) / (24*60*60), "days, APY:", Number(interest6)/100, "%");
    console.log("12 months:", Number(term12) / (24*60*60), "days, APY:", Number(interest12)/100, "%");
    
    console.log("\n✅ Staking system deployed successfully!");
    
  } catch (error) {
    console.error("❌ Error verifying deployment:", error);
  }
};

export default func;
func.tags = ["StakingContract", "staking"];
func.dependencies = [];