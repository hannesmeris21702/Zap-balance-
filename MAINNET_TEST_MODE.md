# MAINNET SAFE TEST MODE - User Guide

## Overview

MAINNET SAFE TEST MODE is a safety feature that allows you to test the rebalance bot on Sui mainnet with real transactions, but with strict safety constraints to minimize risk.

## What is MAINNET SAFE TEST MODE?

A single-shot execution mode that:
- ✅ Uses **real mainnet** transactions
- ✅ Uses your **real wallet**
- ✅ Processes **ONLY ONE position** (the first found)
- ✅ Executes **ONLY ONE rebalance cycle**
- ✅ **Exits immediately** after completion
- ✅ **Aborts on any error**

## Why Use Test Mode?

Before running the bot in continuous monitoring mode on mainnet, test mode lets you:
1. Verify the bot works correctly with your wallet
2. Test rebalancing with a single position
3. Check that transactions execute successfully
4. Minimize risk by limiting exposure to one position
5. Gain confidence before enabling continuous mode

## Setup

### 1. Configure Environment

Edit your `.env` file:

```bash
# Enable test mode
MAINNET_TEST_MODE=true

# Your mainnet configuration
SUI_RPC_URL=https://fullnode.mainnet.sui.io:443
WALLET_PRIVATE_KEY=your_private_key_here
REBALANCE_INTERVAL_MS=60000
```

### 2. Build and Run

```bash
npm run build
npm start
```

## Expected Behavior

### Scenario 1: Position IN RANGE

If your first position is already in range:

```
Bot initialized for wallet: 0x...
⚠️  MAINNET TEST MODE ENABLED - Will process ONE position and exit
🧪 Starting MAINNET SAFE TEST MODE...
Will process ONE position and exit immediately

--- Starting rebalance cycle ---
Querying wallet for Cetus CLMM positions...
Found 3 positions with liquidity
MAINNET TEST MODE: Processing ONLY the first position out of 3 found

Processing position: 0xabc123...
✓ MAINNET TEST: position IN_RANGE
No rebalance needed. Exiting safely.
```

**Result**: Exit code 0, no transactions executed

### Scenario 2: Position OUT OF RANGE (Successful Rebalance)

If your first position is out of range:

```
Bot initialized for wallet: 0x...
⚠️  MAINNET TEST MODE ENABLED - Will process ONE position and exit
🧪 Starting MAINNET SAFE TEST MODE...
Will process ONE position and exit immediately

--- Starting rebalance cycle ---
Querying wallet for Cetus CLMM positions...
Found 3 positions with liquidity
MAINNET TEST MODE: Processing ONLY the first position out of 3 found

Processing position: 0xabc123...
⚠️  MAINNET TEST: position OUT_OF_RANGE
Initiating rebalance...

Closing position 0xabc123...
Position closed successfully. Transaction: 0xdef456...
Returned tokens to wallet

New range determined: [-200, 200] around tick 5

Executing ZAP (using SDK to add liquidity with available tokens)...
Available tokens: 1000000 of coinA, 2000000 of coinB
Position NFT created. Transaction: 0xghi789...
New position ID: 0xjkl012...
ZAP executed - SDK handling liquidity addition with token optimization
Liquidity added successfully. Transaction: 0xmno345...

✅ MAINNET TEST SUCCESS
New position ID: 0xjkl012...
Rebalance completed successfully. Exiting.
```

**Result**: 
- Exit code 0
- Old position closed
- New position created
- Liquidity rebalanced

### Scenario 3: Error During Rebalance

If an error occurs:

```
Bot initialized for wallet: 0x...
⚠️  MAINNET TEST MODE ENABLED - Will process ONE position and exit
🧪 Starting MAINNET SAFE TEST MODE...
Will process ONE position and exit immediately

--- Starting rebalance cycle ---
Querying wallet for Cetus CLMM positions...
Found 3 positions with liquidity
MAINNET TEST MODE: Processing ONLY the first position out of 3 found

Processing position: 0xabc123...
⚠️  MAINNET TEST: position OUT_OF_RANGE
Initiating rebalance...

Closing position 0xabc123...
Error closing position 0xabc123: [error details]
Failed to close position - aborting
❌ MAINNET TEST FAILED: Could not close position
```

**Result**: Exit code 1, operation aborted

## After Running Test Mode

### If Test Succeeded ✅

1. **Verify on Sui Explorer**:
   - Check the transaction hashes provided in the logs
   - Verify the old position is closed
   - Verify the new position exists with liquidity

2. **Check Your Wallet**:
   - Confirm the new position appears
   - Verify the liquidity amounts are correct
   - Check that fees were collected

3. **Enable Continuous Mode**:
   ```bash
   # In .env file
   MAINNET_TEST_MODE=false
   ```
   
4. **Run in Production**:
   ```bash
   npm start
   ```

### If Test Failed ❌

1. **Review Error Logs**:
   - Check what went wrong
   - Look for transaction errors
   - Verify RPC connectivity

2. **Common Issues**:
   - Insufficient SUI for gas fees
   - Invalid private key format
   - RPC endpoint timeout
   - No positions with liquidity

3. **Fix and Retry**:
   - Address the issue
   - Run test mode again
   - Repeat until successful

## Safety Features

### What Test Mode DOES:
- ✅ Processes exactly one position
- ✅ Executes real mainnet transactions
- ✅ Exits immediately after completion
- ✅ Aborts on any error

### What Test Mode DOES NOT:
- ❌ Process multiple positions
- ❌ Run in a loop
- ❌ Continue after errors
- ❌ Retry failed operations

## Comparison: Test Mode vs Normal Mode

| Feature | Test Mode | Normal Mode |
|---------|-----------|-------------|
| Positions processed | First only | All positions |
| Execution | Single-shot | Continuous loop |
| Exit behavior | Immediate | Never (until Ctrl+C) |
| Error handling | Abort & exit | Log & continue |
| Use case | Testing/verification | Production monitoring |

## Best Practices

1. **Always test first**: Run test mode before enabling continuous monitoring
2. **One position at a time**: Use test mode to rebalance positions individually
3. **Check results**: Always verify transactions on Sui explorer
4. **Monitor gas**: Ensure sufficient SUI for multiple transactions
5. **Backup private key**: Keep your private key secure and backed up

## Exit Codes

- **0**: Success (either position was in range OR rebalance completed)
- **1**: Failure (error occurred during rebalancing)

## Advanced: Scripting with Test Mode

You can use test mode in scripts with exit code handling:

```bash
#!/bin/bash

# Run test mode
npm start

# Check exit code
if [ $? -eq 0 ]; then
    echo "Test successful!"
    # Continue with other operations
else
    echo "Test failed!"
    # Handle failure
    exit 1
fi
```

## Troubleshooting

### "No positions found with liquidity"
- Your wallet doesn't have any active Cetus CLMM positions
- Add liquidity to a Cetus pool first

### "MAINNET TEST FAILED: Could not close position"
- Insufficient gas (need SUI for transaction fees)
- Position may be locked or have active orders
- Check RPC connectivity

### "ZAP failed"
- Insufficient token balance after closing position
- Pool liquidity issues
- Check transaction logs for details

### "Failed to find created position NFT"
- **This issue has been fixed** - The bot now waits for transaction confirmation and retries up to 5 times with exponential backoff
- If you still encounter this error after retries, the bot will provide the transaction digest
- Check Sui explorer using the provided transaction digest to verify if position was created
- The retry logic handles cases where position NFT might not be immediately visible

## Support

For issues or questions:
1. Check the main README.md
2. Review ZAP_IMPLEMENTATION.md for technical details
3. Check Cetus documentation
4. Review Sui explorer for transaction details

## Summary

MAINNET SAFE TEST MODE provides a safe way to:
- ✅ Test rebalancing on mainnet
- ✅ Verify bot functionality
- ✅ Minimize risk exposure
- ✅ Gain confidence before production use

Always use test mode first, verify results, then enable continuous monitoring.
