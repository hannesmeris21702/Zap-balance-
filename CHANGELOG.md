# Changelog

All notable changes to the Cetus CLMM Rebalance Bot project.

## [1.1.0] - 2026-02-15

### Added - MAINNET SAFE TEST MODE
- New `MAINNET_TEST_MODE` environment variable for single-shot testing
- Safe testing on mainnet with real transactions
- Processes ONLY ONE position per run
- Executes ONLY ONE rebalance cycle
- Exits immediately after completion
- Aborts immediately on any error
- Enhanced logging with test mode indicators:
  - 🧪 "Starting MAINNET SAFE TEST MODE..."
  - ✓ "MAINNET TEST: position IN_RANGE"
  - ⚠️ "MAINNET TEST: position OUT_OF_RANGE"
  - ✅ "MAINNET TEST SUCCESS" + new position ID
  - ❌ "MAINNET TEST FAILED" + error details
- Exit code handling (0 = success, 1 = failure)
- Comprehensive user guide (MAINNET_TEST_MODE.md)
- README section with usage examples

### Changed
- `zapAndAddLiquidity()` now returns new position ID (string | null)
- `rebalance()` method handles both test mode and normal mode
- `start()` method detects and handles test mode
- Constructor initializes `isTestMode` property
- Main implementation now 503 lines (was 445 lines)

### Documentation
- Updated README.md with MAINNET SAFE TEST MODE section
- Created MAINNET_TEST_MODE.md user guide
- Added .env.example documentation for test mode
- Updated CHANGELOG.md with v1.1.0 changes

## [1.0.0] - 2026-02-15

### Added
- Initial implementation of ZAP-based rebalance bot for Cetus CLMM on Sui Network
- Auto-detection of all Cetus CLMM positions with liquidity in wallet
- In-range / out-of-range position monitoring
- Automatic position closing when out of range (removes liquidity, collects fees)
- Intelligent new range determination based on current pool price
- ZAP-like functionality using Cetus SDK:
  - Opens new position NFT with target range
  - Adds liquidity using available wallet tokens
  - Lets SDK handle all token ratio optimization
- Simple logging for monitoring (IN_RANGE/OUT_OF_RANGE, zap executed, liquidity added)
- Safe failure handling with abort on error
- Configurable rebalance interval
- TypeScript implementation with full type safety
- Comprehensive documentation (README.md, ZAP_IMPLEMENTATION.md)

### Features
- No manual calculations or ratio logic (as per requirements)
- No 50/50 forcing or manual swap logic (as per requirements)
- Uses only Cetus SDK functions (as per requirements)
- Simple and maintainable code structure

### Configuration
- RANGE_WIDTH_MULTIPLIER constant for position concentration strategy
- Environment-based configuration via .env file
- Validation for rebalance interval (minimum 1 second)

### Security
- CodeQL security scan passed with 0 alerts
- Private key security best practices documented
- Input validation for configuration parameters

### Documentation
- Complete README with setup instructions
- ZAP implementation technical notes
- Code comments explaining design decisions
- Environment configuration template

## Project Structure
```
.
├── src/
│   └── index.ts                  # Main bot implementation (503 lines)
├── .env.example                  # Environment configuration template
├── .gitignore                   # Git ignore rules
├── package.json                 # Project dependencies
├── tsconfig.json                # TypeScript configuration
├── README.md                    # Setup and usage guide
├── MAINNET_TEST_MODE.md         # Test mode user guide
├── ZAP_IMPLEMENTATION.md        # Technical ZAP notes
├── IMPLEMENTATION_SUMMARY.md    # Complete implementation details
└── CHANGELOG.md                 # This file
```

## Future Enhancements (Not in Scope)
- Multi-pool support
- Advanced range strategies
- Profitability tracking
- Web dashboard
- Alert notifications
