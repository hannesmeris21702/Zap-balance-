# Changelog

All notable changes to the Cetus CLMM Rebalance Bot project.

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
│   └── index.ts           # Main bot implementation
├── .env.example           # Environment configuration template
├── .gitignore            # Git ignore rules
├── package.json          # Project dependencies
├── tsconfig.json         # TypeScript configuration
├── README.md             # Setup and usage guide
├── ZAP_IMPLEMENTATION.md # Technical ZAP notes
└── CHANGELOG.md          # This file
```

## Future Enhancements (Not in Scope)
- Multi-pool support
- Advanced range strategies
- Profitability tracking
- Web dashboard
- Alert notifications
