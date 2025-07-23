import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("=== Deploying Staking System ===");
  console.log("Deployer:", deployer);

  // Deploy MyToken first
  console.log("📦 Deploying new MyToken...");
  const tokenDeployment = await deploy("MyToken", {
    from: deployer,
    args: [
      "USD Coin",
      "USDC", 
      ethers.parseEther("1000000") // 1M tokens
    ],
    log: true,
  });

  console.log("✅ MyToken deployed at:", tokenDeployment.address);

  // Deploy StakingContract
  console.log("📦 Deploying StakingContract...");
  const stakingDeployment = await deploy("StakingContract", {
    from: deployer,
    args: [tokenDeployment.address],
    log: true,
  });

  console.log("✅ StakingContract deployed at:", stakingDeployment.address);

  // Setup reward pool
  console.log("🔧 Setting up reward pool...");
  
  const [deployerSigner] = await ethers.getSigners();
  const token = await ethers.getContractAt("MyToken", tokenDeployment.address);
  const stakingContract = await ethers.getContractAt("StakingContract", stakingDeployment.address);

  // Check deployer balance
  const deployerBalance = await token.balanceOf(deployer);
  console.log("Deployer balance:", ethers.formatEther(deployerBalance), "tokens");

  // Transfer reward pool to staking contract (10% of total supply)
  const rewardPool = ethers.parseEther("100000"); // 100k tokens for rewards
  
  console.log("💰 Transferring reward pool...");
  const transferTx = await token.connect(deployerSigner).transfer(
    stakingDeployment.address, 
    rewardPool
  );
  await transferTx.wait();

  // Check final balances
  const stakingBalance = await token.balanceOf(stakingDeployment.address);
  const finalDeployerBalance = await token.balanceOf(deployer);

  console.log("✅ Setup complete!");
  console.log("📊 Final balances:");
  console.log("   Deployer:", ethers.formatEther(finalDeployerBalance), "USDC");
  console.log("   Staking contract:", ethers.formatEther(stakingBalance), "USDC");
  console.log("");
  console.log("🎯 Contract addresses:");
  console.log("   Token:", tokenDeployment.address);
  console.log("   Staking:", stakingDeployment.address);
  console.log("");
  console.log("🚀 Ready to use! Run the CLI:");
  console.log("   yarn hardhat run scripts/staking-cli.ts --network localhost");
};

export default func;
func.tags = ["StakingContract"];