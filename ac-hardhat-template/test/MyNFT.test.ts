import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import "@nomicfoundation/hardhat-chai-matchers";
import { MyNFT } from "../typechain";

describe("MyNFT", function () {
  async function deployMyNFTFixture() {
    const [owner, addr1, addr2] = await ethers.getSigners();

    const MyNFT = await ethers.getContractFactory("MyNFT");
    const myNFT = await MyNFT.deploy();
    await myNFT.waitForDeployment();
    
    return { myNFT, owner, addr1, addr2 };
  }

  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      const { myNFT } = await loadFixture(deployMyNFTFixture);

      expect(await myNFT.name()).to.equal("MyNFT");
      expect(await myNFT.symbol()).to.equal("MNFT");
    });

    it("Should set owner correctly", async function () {
      const { myNFT, owner } = await loadFixture(deployMyNFTFixture);

      expect(await myNFT.owner()).to.equal(owner.address);
    });

    it("Should start with nextTokenId = 0", async function () {
      const { myNFT } = await loadFixture(deployMyNFTFixture);

      expect(await myNFT.nextTokenId()).to.equal(0n);
      expect(await myNFT.totalSupply()).to.equal(0n);
    });
  });

  describe("Minting", function () {
    it("Should mint NFT to specified address", async function () {
      const { myNFT, owner, addr1 } = await loadFixture(deployMyNFTFixture);

      await myNFT.mint(addr1.address);

      expect(await myNFT.ownerOf(0)).to.equal(addr1.address);
      expect(await myNFT.balanceOf(addr1.address)).to.equal(1n);
      expect(await myNFT.nextTokenId()).to.equal(1n);
      expect(await myNFT.totalSupply()).to.equal(1n);
    });

    it("Should increment nextTokenId after each mint", async function () {
      const { myNFT, owner, addr1, addr2 } = await loadFixture(deployMyNFTFixture);

      await myNFT.mint(addr1.address);
      expect(await myNFT.nextTokenId()).to.equal(1n);

      await myNFT.mint(addr2.address);
      expect(await myNFT.nextTokenId()).to.equal(2n);
      expect(await myNFT.totalSupply()).to.equal(2n);
    });

    it("Should only allow owner to mint", async function () {
      const { myNFT, owner, addr1 } = await loadFixture(deployMyNFTFixture);

      await expect(
        myNFT.connect(addr1).mint(addr1.address)
      ).to.be.revertedWithCustomError(myNFT, "OwnableUnauthorizedAccount")
       .withArgs(addr1.address);
    });

    it("Should emit Transfer event when minting", async function () {
      const { myNFT, owner, addr1 } = await loadFixture(deployMyNFTFixture);

      await expect(myNFT.mint(addr1.address))
        .to.emit(myNFT, "Transfer")
        .withArgs(ethers.ZeroAddress, addr1.address, 0);
    });
  });
});