import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import "@nomicfoundation/hardhat-chai-matchers";
import { MyMintableToken } from "../typechain";

describe("MyMintableToken", function () {
  async function deployMyMintableTokenFixture() {
    const [owner, addr1, addr2] = await ethers.getSigners();

    const MyMintableToken = await ethers.getContractFactory("MyMintableToken");
    const myMintableToken = await MyMintableToken.deploy();
    await myMintableToken.waitForDeployment();
    
    return { myMintableToken, owner, addr1, addr2 };
  }

  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      const { myMintableToken } = await loadFixture(deployMyMintableTokenFixture);

      expect(await myMintableToken.name()).to.equal("MyMintableToken");
      expect(await myMintableToken.symbol()).to.equal("MMT");
    });

    it("Should set owner correctly", async function () {
      const { myMintableToken, owner } = await loadFixture(deployMyMintableTokenFixture);

      expect(await myMintableToken.owner()).to.equal(owner.address);
    });

    it("Should start with zero total supply", async function () {
      const { myMintableToken } = await loadFixture(deployMyMintableTokenFixture);

      expect(await myMintableToken.totalSupply()).to.equal(0n);
    });

    it("Should have 18 decimals", async function () {
      const { myMintableToken } = await loadFixture(deployMyMintableTokenFixture);

      expect(await myMintableToken.decimals()).to.equal(18);
    });
  });

  describe("Minting", function () {
    it("Should mint tokens to specified address", async function () {
      const { myMintableToken, owner, addr1 } = await loadFixture(deployMyMintableTokenFixture);
      const mintAmount = ethers.parseUnits("1000", 18);

      await myMintableToken.mint(addr1.address, mintAmount);

      expect(await myMintableToken.balanceOf(addr1.address)).to.equal(mintAmount);
      expect(await myMintableToken.totalSupply()).to.equal(mintAmount);
    });

    it("Should increase total supply after minting", async function () {
      const { myMintableToken, owner, addr1, addr2 } = await loadFixture(deployMyMintableTokenFixture);
      const mintAmount1 = ethers.parseUnits("500", 18);
      const mintAmount2 = ethers.parseUnits("300", 18);

      await myMintableToken.mint(addr1.address, mintAmount1);
      expect(await myMintableToken.totalSupply()).to.equal(mintAmount1);

      await myMintableToken.mint(addr2.address, mintAmount2);
      expect(await myMintableToken.totalSupply()).to.equal(mintAmount1 + mintAmount2);
    });

    it("Should only allow owner to mint", async function () {
      const { myMintableToken, owner, addr1 } = await loadFixture(deployMyMintableTokenFixture);
      const mintAmount = ethers.parseUnits("1000", 18);

      await expect(
        myMintableToken.connect(addr1).mint(addr1.address, mintAmount)
      ).to.be.revertedWithCustomError(myMintableToken, "OwnableUnauthorizedAccount")
       .withArgs(addr1.address);
    });

    it("Should emit Transfer event when minting", async function () {
      const { myMintableToken, owner, addr1 } = await loadFixture(deployMyMintableTokenFixture);
      const mintAmount = ethers.parseUnits("1000", 18);

      await expect(myMintableToken.mint(addr1.address, mintAmount))
        .to.emit(myMintableToken, "Transfer")
        .withArgs(ethers.ZeroAddress, addr1.address, mintAmount);
    });
  });

  describe("Burning", function () {
    it("Should burn tokens from specified address", async function () {
      const { myMintableToken, owner, addr1 } = await loadFixture(deployMyMintableTokenFixture);
      const mintAmount = ethers.parseUnits("1000", 18);
      const burnAmount = ethers.parseUnits("300", 18);

      // Mint
      await myMintableToken.mint(addr1.address, mintAmount);
      expect(await myMintableToken.balanceOf(addr1.address)).to.equal(mintAmount);

      // Burn
      await myMintableToken.burn(addr1.address, burnAmount);
      expect(await myMintableToken.balanceOf(addr1.address)).to.equal(mintAmount - burnAmount);
      expect(await myMintableToken.totalSupply()).to.equal(mintAmount - burnAmount);
    });

    it("Should only allow owner to burn", async function () {
      const { myMintableToken, owner, addr1 } = await loadFixture(deployMyMintableTokenFixture);
      const mintAmount = ethers.parseUnits("1000", 18);
      const burnAmount = ethers.parseUnits("300", 18);

      await myMintableToken.mint(addr1.address, mintAmount);

      await expect(
        myMintableToken.connect(addr1).burn(addr1.address, burnAmount)
      ).to.be.revertedWithCustomError(myMintableToken, "OwnableUnauthorizedAccount")
       .withArgs(addr1.address);
    });
  });
});