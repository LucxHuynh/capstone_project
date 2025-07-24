import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("🚀 Deploying Staking System");
  console.log("👤 Deployer:", deployer);

  // Deploy Token
  const token = await deploy("MyToken", {
    from: deployer,
    args: ["USD Coin", "USDC", ethers.parseEther("1000000")],
    log: true,
  });

  // Deploy Staking Contract
  const staking = await deploy("StakingContract", {
    from: deployer,
    args: [token.address],
    log: true,
  });

  // Setup reward pool
  console.log("💰 Setting up reward pool...");
  const [signer] = await ethers.getSigners();
  const tokenContract = await ethers.getContractAt("MyToken", token.address);
  
  const rewardPool = ethers.parseEther("100000"); // 100k for rewards
  await tokenContract.connect(signer).transfer(staking.address, rewardPool);

  // Summary
  console.log("\n✅ Deployment Complete!");
  console.log("📄 Token:", token.address);
  console.log("📄 Staking:", staking.address);
  console.log("💰 Reward Pool: 100,000 USDC");
  console.log("\n🚀 Run CLI: yarn hardhat run scripts/staking-cli.ts --network localhost");
};

export default func;
func.tags = ["StakingContract"];