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

## 🚀 Deploy & Run

### Option 1: Local Development
```bash
# Terminal 1: Start local node
yarn hardhat node

# Terminal 2: Deploy contracts
yarn hardhat deploy --tags StakingContract --network localhost

# Terminal 3: Run CLI
yarn hardhat run scripts/staking-cli.ts --network localhost
```

### Option 2: Testnet (Sepolia)
```bash
# 1. Deploy contracts
yarn hardhat deploy --tags StakingContract --network sepolia

# 2. Run CLI (connects to deployed contracts)
yarn hardhat run scripts/staking-cli.ts --network sepolia

# 3. Verify contracts (optional)
yarn hardhat verify --network sepolia <STAKING_ADDRESS> <TOKEN_ADDRESS>
```

### Option 3: Quick Test (Auto-deploy)
```bash
# CLI sẽ tự động deploy contracts mới nếu không tìm thấy
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
yarn compile                                    # Compile contracts
yarn test                                       # Run all tests
yarn clean                                      # Clean build
yarn size                                       # Check contract sizes
yarn node                                       # Start local blockchain

# Deploy to different networks
yarn hardhat deploy --tags StakingContract --network localhost
yarn hardhat deploy --tags StakingContract --network sepolia

# Run CLI on different networks  
yarn hardhat run scripts/staking-cli.ts --network localhost
yarn hardhat run scripts/staking-cli.ts --network sepolia
```

## 📋 Test Results

```
✅ All 20 test cases passing
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

## Video demo
🎥 Xem video demo tại đây: https://drive.google.com/file/d/19n5SvDr_DAURHAh6oyJa1mhj1wnDGEZf/view