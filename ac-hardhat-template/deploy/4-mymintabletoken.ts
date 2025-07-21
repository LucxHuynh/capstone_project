import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("====================");
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer);
  console.log("====================");

  console.log("====================");
  console.log("Deploy MyMintableToken Contract");
  console.log("====================");

  const deployResult = await deploy("MyMintableToken", {
    contract: "MyMintableToken",
    args: [],
    from: deployer,
    log: true,
    autoMine: true,
    skipIfAlreadyDeployed: false,
  });

  console.log("✅ MyMintableToken deployed to:", deployResult.address);

  // Get contract instance
  const myMintableToken = await ethers.getContractAt("MyMintableToken", deployResult.address);

  console.log("====================");
  console.log("🪙 Mint 1000 tokens to deployer");
  console.log("====================");

  // Mint 1000 tokens (với 18 decimals)
  const mintAmount = ethers.parseUnits("1000", 18);
  const mintTx = await myMintableToken.mint(deployer, mintAmount);
  await mintTx.wait();

  console.log("✅ 1000 MMT tokens minted to:", deployer);

  // Check token info
  const name = await myMintableToken.name();
  const symbol = await myMintableToken.symbol();
  const decimals = await myMintableToken.decimals();
  const totalSupply = await myMintableToken.totalSupply();
  const deployerBalance = await myMintableToken.balanceOf(deployer);

  console.log("📊 Token Details:");
  console.log("   Name:", name);
  console.log("   Symbol:", symbol);
  console.log("   Decimals:", decimals);
  console.log("   Total Supply:", ethers.formatUnits(totalSupply, 18));
  console.log("   Deployer Balance:", ethers.formatUnits(deployerBalance, 18));

  console.log("====================");
  console.log("🎉 Deployment completed!");
  console.log("====================");
};

func.tags = ["mymintabletoken"];
export default func;