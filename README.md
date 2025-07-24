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
yarn hardhat node

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

## Run CLI

### Localhost
```bash
# Terminal 1 (để chạy liên tục)
yarn hardhat node

# Terminal 2 (commands). Deploy in another terminal
yarn hardhat deploy --tags StakingContract --network localhost

# Run CLI (other terminal)
yarn hardhat run scripts/staking-cli.ts --network localhost
```


## 📊 Contract Info

### Staking Terms (Optimized Rates)
- **3 tháng**: 90 ngày, 0.25% return (1% APY)
- **6 tháng**: 180 ngày, 1.25% return (2.5% APY)  
- **12 tháng**: 365 ngày, 6.0% return (6% APY)

### Admin Features
- **Dynamic Rate Management**: Owner có thể thay đổi lãi suất
- **Flexible Terms**: Có thể thêm/xóa terms mới
- **Emergency Withdraw**: Bảo vệ khỏi hack

### Key Functions
- `deposit(amount, term)` - Gửi token để stake
- `claim(stakeId)` - Claim rewards
- `withdraw(stakeId)` - Rút stake (có phí nếu rút sớm)
- `setTermRate(term, rate)` - Admin: Set lãi suất cho term
- `setPenaltyRate(rate)` - Admin: Set phí rút sớm

## 📁 Structure

```
ac-hardhat-template/
├── contracts/StakingContract.sol    # Main contract (Optimized)
├── contracts/MyToken.sol           # Test token
├── test/StakingContract.test.ts     # Comprehensive tests
├── scripts/staking-cli.ts          # Interactive CLI
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

## 📋 Test Results

```
✅ All 26 test cases passing
✅ Gas optimized storage
✅ Comprehensive edge case coverage
✅ Admin function security
✅ Dynamic rate management
```

---

**⚠️ Security Notes:**
- Không commit private key
- Test trên testnet trước
- Backup private key an toàn
- Contract đã được optimize và test kỹ lưỡng