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
CETUS_PACKAGE_ID=0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb
CETUS_GLOBAL_CONFIG=0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f
REBALANCE_INTERVAL_MS=60000
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SUI_RPC_URL` | Sui RPC endpoint URL | `https://fullnode.mainnet.sui.io:443` |
| `WALLET_PRIVATE_KEY` | Your wallet's private key (hex format) | Required |
| `CETUS_PACKAGE_ID` | Cetus protocol package ID | See `.env.example` |
| `CETUS_GLOBAL_CONFIG` | Cetus global config object ID | See `.env.example` |
| `REBALANCE_INTERVAL_MS` | Time between rebalance checks (milliseconds) | `60000` (1 minute) |

### Important Notes

- **No position ID required**: The bot auto-detects all positions with liquidity
- **Private key security**: Keep your `.env` file secure and never commit it to version control
- **Gas fees**: Ensure your wallet has sufficient SUI for transaction fees

## Usage

### Build the project:
```bash
npm run build
```

### Start the bot:
```bash
npm start
```

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
