# 🚀 Staking Contract Project

Hệ thống staking contract với lãi suất cố định theo thời hạn.

## 📦 Cài đặt

```bash
# Cài dependencies
npm install
cd ac-hardhat-template
npm install -g yarn
yarn install
```

## ⚙️ Cấu hình

1. **Tạo file `.env`** từ mẫu:
```bash
cp .env_example .env
```

2. **Sửa `.env`** với private key của bạn:
```properties
REPORT_GAS=true
TESTNET_PRIVATE_KEY=0x<your_64_character_private_key>
MAINNET_PRIVATE_KEY=0x<your_64_character_private_key>
ETHERSCAN_API=your_etherscan_api_key_here
```

## 🔨 Build & Test

```bash
# Clean và compile
yarn clean
yarn compile

# Chạy tests
yarn test

# Test file cụ thể
yarn test test/StakingContract.test.ts
```

## 🚀 Deploy

### Local Network
```bash
# Terminal 1: Start local node
yarn node

# Terminal 2: Deploy
yarn hardhat deploy --tags StakingContract
```

### Sepolia Testnet
```bash
# Deploy to testnet
yarn hardhat deploy --network sepolia --tags StakingContract

# Verify contract
yarn hardhat verify --network sepolia <STAKING_CONTRACT_ADDRESS> <TOKEN_ADDRESS>
```

### Ethereum Mainnet
```bash
# Deploy to mainnet (THẬN TRỌNG!)
yarn hardhat deploy --network ethereum --tags StakingContract
```

## 📊 Contract Info

### Staking Terms
- **3 tháng**: 90 ngày, 1.0% APY
- **6 tháng**: 180 ngày, 2.5% APY  
- **12 tháng**: 365 ngày, 6.0% APY

### Key Functions
- `deposit(amount, term)` - Gửi token để stake
- `claim(stakeId)` - Claim rewards
- `withdraw(stakeId)` - Rút stake (có phí nếu rút sớm)


## 📁 Structure

```
ac-hardhat-template/
├── contracts/StakingContract.sol    # Main contract
├── contracts/MyToken.sol           # Test token
├── test/StakingContract.test.ts     # Tests
├── deploy/5-staking.ts             # Deploy script
├── .env                            # Config (tạo từ .env_example)
└── hardhat.config.ts               # Hardhat config
```

## 🎯 Quick Commands

```bash
yarn compile          # Compile contracts
yarn test            # Run all tests
yarn clean           # Clean build
yarn size            # Check contract sizes
yarn node            # Start local blockchain
```

---

**⚠️ Security Notes:**
- Không commit private key
- Test trên testnet trước
- Backup private key an toàn