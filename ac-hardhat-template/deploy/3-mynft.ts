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
  console.log("Deploy MyNFT Contract");
  console.log("====================");

  const deployResult = await deploy("MyNFT", {
    contract: "MyNFT",
    args: [],
    from: deployer,
    log: true,
    autoMine: true,
    skipIfAlreadyDeployed: false,
  });

  console.log("✅ MyNFT deployed to:", deployResult.address);

  const myNFT = await ethers.getContractAt("MyNFT", deployResult.address);

  console.log("====================");
  console.log("🎨 Mint NFT #0 to deployer");
  console.log("====================");

  // Mint NFT to deployer
  const mintTx = await myNFT.mint(deployer);
  await mintTx.wait();

  console.log("✅ NFT #0 minted to:", deployer);

  // Check owner of token 0
  const owner = await myNFT.ownerOf(0);
  console.log("🔍 Owner of token #0:", owner);

  // Check current token ID
  const currentTokenId = await myNFT.getCurrentTokenId();
  console.log("📊 Next token ID:", currentTokenId.toString());

  const totalSupply = await myNFT.totalSupply();
  console.log("📊 Total Supply:", totalSupply.toString());
};

func.tags = ["mynft"];
export default func;