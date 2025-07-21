import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import "@nomicfoundation/hardhat-chai-matchers";
import { MyToken } from "../typechain";

describe("MyToken", function () {
  async function deployMyTokenFixture() {
    const [owner, addr1, addr2] = await ethers.getSigners();

    const MyToken = await ethers.getContractFactory("MyToken");
    const myToken = await MyToken.deploy();
    await myToken.waitForDeployment();
    return { myToken, owner, addr1, addr2 };
  }

  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      const { myToken } = await loadFixture(deployMyTokenFixture);

      expect(await myToken.name()).to.equal("MyToken");
      expect(await myToken.symbol()).to.equal("MTK");
    });

    it("Should mint 1,000,000 tokens to the owner", async function () {
      const { myToken, owner } = await loadFixture(deployMyTokenFixture);

      const ownerBalance = await myToken.balanceOf(owner.address);
      expect(await myToken.totalSupply()).to.equal(ownerBalance);
      expect(ethers.formatUnits(ownerBalance, 18)).to.equal("1000000.0");
    });

    it("Should have 18 decimals", async function () {
      const { myToken } = await loadFixture(deployMyTokenFixture);

      expect(await myToken.decimals()).to.equal(18n);
    });
  });

  describe("Transactions", function () {
    it("Should transfer tokens between accounts", async function () {
      const { myToken, owner, addr1, addr2 } = await loadFixture(deployMyTokenFixture);

      // Transfer 50 tokens from owner to addr1
      const transferAmount = ethers.parseUnits("50", 18);
      
      const ownerBalanceBefore = await myToken.balanceOf(owner.address);
      const addr1BalanceBefore = await myToken.balanceOf(addr1.address);
      
      await myToken.transfer(addr1.address, transferAmount);
      
      const ownerBalanceAfter = await myToken.balanceOf(owner.address);
      const addr1BalanceAfter = await myToken.balanceOf(addr1.address);
      
      expect(ownerBalanceAfter).to.equal(ownerBalanceBefore - transferAmount);
      expect(addr1BalanceAfter).to.equal(addr1BalanceBefore + transferAmount);

      // Transfer 50 tokens from addr1 to addr2
      const addr1BalanceBefore2 = await myToken.balanceOf(addr1.address);
      const addr2BalanceBefore = await myToken.balanceOf(addr2.address);
      
      await myToken.connect(addr1).transfer(addr2.address, transferAmount);
      
      const addr1BalanceAfter2 = await myToken.balanceOf(addr1.address);
      const addr2BalanceAfter = await myToken.balanceOf(addr2.address);
      
      expect(addr1BalanceAfter2).to.equal(addr1BalanceBefore2 - transferAmount);
      expect(addr2BalanceAfter).to.equal(addr2BalanceBefore + transferAmount);
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const { myToken, owner, addr1 } = await loadFixture(deployMyTokenFixture);
      const initialOwnerBalance = await myToken.balanceOf(owner.address);

      // Try to send 1 token from addr1 (0 tokens) to owner.
      await expect(
        myToken.connect(addr1).transfer(owner.address, ethers.parseUnits("1", 18))
      ).to.be.reverted;

      // Owner balance shouldn't have changed.
      expect(await myToken.balanceOf(owner.address)).to.equal(initialOwnerBalance);
    });
  });
});