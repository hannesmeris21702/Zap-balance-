# Cetus CLMM Rebalance Bot

A simple, ZAP-based rebalance bot for Cetus Concentrated Liquidity Market Maker (CLMM) pools on the Sui Network.

## Overview

This bot automatically monitors your Cetus CLMM positions and rebalances them when they go out of range. It uses the Cetus SDK's ZAP functionality to handle all token swaps internally, ensuring optimal liquidity provision without manual calculations.

## Features

- ✅ **Auto-detection**: Automatically discovers all Cetus CLMM positions with liquidity in your wallet
- ✅ **Simple logic**: No complex calculations, ratios, or manual swap logic
- ✅ **ZAP-based**: Uses Cetus SDK's ZAP function to handle all token swaps internally
- ✅ **Safe rebalancing**: Removes liquidity, collects fees, and rebalances only when positions are out of range
- ✅ **Continuous monitoring**: Runs on a configurable interval to keep positions in range

## Logic Flow

1. **Query positions**: Check wallet for all Cetus CLMM positions with liquidity
2. **Check range status**: For each position, determine if current price is inside the position tick range
   - If **IN_RANGE**: Log status and continue monitoring
   - If **OUT_OF_RANGE**: Proceed to rebalance
3. **Close position**: Remove 100% liquidity, collect fees, close position NFT (tokens returned to wallet automatically)
4. **Determine new range**: Use Cetus SDK helpers to calculate optimal range based on current pool price
5. **ZAP and add liquidity**: Open new position with wallet tokens - SDK handles all token ratio optimization internally
6. **Handle failures**: If any step fails, abort safely and log the reason

### ZAP Implementation

This bot implements ZAP-based rebalancing without manual calculations:
- Uses SDK's `closePositionTransactionPayload()` to return tokens to wallet
- Uses SDK's `openPositionTransactionPayload()` which intelligently handles token ratios
- The Cetus smart contracts automatically optimize token usage for the new range
- No manual swaps, ratio calculations, or liquidity math required

See [ZAP_IMPLEMENTATION.md](./ZAP_IMPLEMENTATION.md) for technical details on the ZAP approach.

## Requirements

- Node.js 16+ and npm
- A Sui wallet with:
  - Existing Cetus CLMM positions
  - Sufficient SUI for gas fees
- Sui RPC endpoint (mainnet or testnet)

## Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd Zap-balance-
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file from the example:
```bash
cp .env.example .env
```

4. Edit `.env` and add your configuration:
```
SUI_RPC_URL=https://fullnode.mainnet.sui.io:443
WALLET_PRIVATE_KEY=your_private_key_here
REBALANCE_INTERVAL_MS=60000
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SUI_RPC_URL` | Sui RPC endpoint URL | `https://fullnode.mainnet.sui.io:443` |
| `WALLET_PRIVATE_KEY` | Your wallet's private key (hex format) | Required |
| `REBALANCE_INTERVAL_MS` | Time between rebalance checks (milliseconds) | `60000` (1 minute) |
| `MAINNET_TEST_MODE` | Enable safe single-shot test mode | `false` |

### Important Notes

- **No position ID required**: The bot auto-detects all positions with liquidity
- **No manual package IDs required**: The bot uses built-in Cetus mainnet configuration
- **Private key security**: Keep your `.env` file secure and never commit it to version control
- **Gas fees**: Ensure your wallet has sufficient SUI for transaction fees

## Usage

### Normal Mode (Continuous Monitoring)

Build the project:
```bash
npm run build
```

Start the bot:
```bash
npm start
```

The bot will continuously monitor your positions and rebalance when needed.

### MAINNET SAFE TEST MODE (Recommended for First Run)

For safe testing on mainnet with real transactions:

1. Edit `.env` and set:
```bash
MAINNET_TEST_MODE=true
```

2. Build and run:
```bash
npm run build
npm start
```

**What happens in test mode:**
- 🧪 Processes **ONLY the FIRST position** found
- 🔄 Executes **ONLY ONE rebalance cycle**
- ⚡ **Exits immediately** after completion
- ❌ **Aborts on any error**

**Test mode outcomes:**

✅ **Position IN_RANGE:**
```
✓ MAINNET TEST: position IN_RANGE
No rebalance needed. Exiting safely.
Exit code: 0
```

⚠️ **Position OUT_OF_RANGE (Successful Rebalance):**
```
⚠️  MAINNET TEST: position OUT_OF_RANGE
Initiating rebalance...
Closing position...
Executing ZAP...
✅ MAINNET TEST SUCCESS
New position ID: 0x...
Rebalance completed successfully. Exiting.
Exit code: 0
```

❌ **Error During Rebalance:**
```
❌ MAINNET TEST FAILED: Could not close position
Exit code: 1
```

**After successful test:**
1. Verify the new position in your wallet
2. Check transactions on Sui explorer
3. Set `MAINNET_TEST_MODE=false` for continuous monitoring

### Development mode (with auto-reload):
```bash
npm run dev
```

### Stop the bot:
Press `Ctrl+C` in the terminal

## Logging

The bot provides simple, clear logging:

- `position IN_RANGE` - Position is within range, no action needed
- `position OUT_OF_RANGE` - Position is out of range, initiating rebalance
- `Closing position...` - Removing liquidity and closing position
- `Executing ZAP...` - Running ZAP function to prepare tokens
- `Liquidity added successfully` - New position opened
- `ZAP failed` / `Rebalance aborted` - Operation failed, no changes made

## Safety Features

- **Abort on ZAP failure**: If ZAP fails, the bot aborts safely and logs the reason
- **No manual calculations**: All token ratios and swaps are handled by the Cetus SDK
- **Error handling**: Comprehensive error handling prevents crashes and data loss

## Forbidden Operations

This bot intentionally does NOT:
- Calculate token ratios manually
- Force 50/50 token splits
- Perform manual swap logic
- Use custom liquidity calculations
- Call `addLiquidity` without proper token preparation

All token optimization is handled by the Cetus SDK and smart contracts.

## Troubleshooting

### "WALLET_PRIVATE_KEY not set in environment"
- Ensure your `.env` file exists and contains a valid `WALLET_PRIVATE_KEY`

### "No positions found with liquidity"
- Check that your wallet has Cetus CLMM positions with active liquidity
- Verify you're connected to the correct network (mainnet/testnet)

### "MoveAbort error 10 in checked_package_version"
- This error indicates a package version mismatch between the SDK configuration and the on-chain Cetus contracts
- **Fixed in latest version**: The bot now uses the correct `published_at` address that matches the `package_id`
- If you encounter this error, ensure you're using the latest version of the bot

### "ZAP failed"
- Check that you have sufficient tokens in the position
- Verify pool has adequate liquidity for swaps
- Check network connectivity and RPC endpoint

### Transaction failures
- Ensure wallet has sufficient SUI for gas fees
- Check that Cetus protocol addresses are correct for your network

## Architecture

```
src/
└── index.ts          # Main bot implementation
    ├── CetusRebalanceBot class
    ├── getAllPositions()       # Query wallet positions
    ├── checkPositionStatus()   # Check if in/out of range
    ├── closePosition()         # Remove liquidity & close
    ├── determineNewRange()     # Calculate new range
    ├── zapAndAddLiquidity()    # ZAP & add liquidity
    └── rebalance()            # Main rebalance logic
```

## Contributing

Contributions are welcome! Please ensure any changes maintain the simplicity and ZAP-based approach of the bot.

## License

MIT

## Disclaimer

This bot interacts with smart contracts and handles your funds. Use at your own risk. Always:
- Test on testnet first
- Start with small positions
- Monitor the bot's activity
- Keep your private keys secure

The authors are not responsible for any loss of funds.
