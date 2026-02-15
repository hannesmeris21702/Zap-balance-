# Simple ZAP-Based Rebalance Bot

A simple and efficient liquidity position rebalancing bot that uses SDK zap functions. This bot automatically monitors liquidity positions and rebalances them when they go out of range, without any manual calculations or custom math.

## Features

- ✅ **Simple Logic**: Follows a straightforward step-by-step process
- ✅ **ZAP-Based**: Uses SDK zap functions for all liquidity operations
- ✅ **No Manual Math**: No ratio calculations or forced 50/50 splits
- ✅ **Safe Abort**: Fails gracefully with proper error logging
- ✅ **Clear Logging**: Simple status logs for monitoring

## How It Works

The bot follows this simple logic flow:

1. **Check Positions**: Scans wallet for positions with liquidity
2. **Range Check**: For each position, determines if it's IN_RANGE or OUT_OF_RANGE
3. **Rebalance If Needed**: 
   - If IN_RANGE: Do nothing, continue monitoring
   - If OUT_OF_RANGE:
     - Remove 100% liquidity
     - Close the position
     - Store returned tokens and total value
4. **Determine New Range**: Calculate new range based on current price
5. **ZAP Liquidity**: Use SDK zap function with returned tokens
6. **Add Liquidity**: Add liquidity using zap output

## Rules

- ❌ NO ratio calculations
- ❌ NO forced 50/50 splits
- ❌ NO direct addLiquidity calls without zap
- ✅ Always use SDK zap functions
- ✅ Abort safely if zap fails
- ✅ Log all important events

## Installation

1. Clone the repository:
```bash
git clone https://github.com/hannesmeris21702/Zap-balance-.git
cd Zap-balance-
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure the bot:
   - Edit `config.py` with your settings
   - Add wallet address
   - Set RPC URL and network details
   - Configure pool address and tick spacing

## Usage

### Basic Usage

```python
from rebalance_bot import RebalanceBot
from your_sdk import SDKClient  # Replace with your actual SDK

# Initialize SDK client
sdk_client = SDKClient(rpc_url="your_rpc_url")

# Create bot instance
bot = RebalanceBot(
    wallet_address="0x...",
    sdk_client=sdk_client
)

# Run rebalance check
result = bot.run_rebalance_check(
    current_tick=12345,  # Get from SDK
    tick_spacing=60      # Pool tick spacing
)

print(f"Checked {result['positions_checked']} positions")
print(f"Rebalanced {result['positions_rebalanced']} positions")
```

### Continuous Monitoring

```python
import time
from rebalance_bot import RebalanceBot

bot = RebalanceBot(wallet_address="0x...", sdk_client=sdk_client)

# Run continuously
while True:
    # Get current tick from SDK
    current_tick = sdk_client.get_current_tick()
    
    # Run rebalance check
    bot.run_rebalance_check(
        current_tick=current_tick,
        tick_spacing=60
    )
    
    # Wait before next check (e.g., 5 minutes)
    time.sleep(300)
```

## Logging

The bot provides clear, simple logging:

```
2026-02-15 12:00:00 - INFO - Starting rebalance check...
2026-02-15 12:00:01 - INFO - Found 3 positions with liquidity
2026-02-15 12:00:01 - INFO - Position 123 status: IN_RANGE
2026-02-15 12:00:01 - INFO - Position 123 is IN_RANGE - no action needed
2026-02-15 12:00:02 - INFO - Position 456 status: OUT_OF_RANGE
2026-02-15 12:00:02 - INFO - Position 456 is OUT_OF_RANGE - rebalancing...
2026-02-15 12:00:03 - INFO - Liquidity removed from position 456
2026-02-15 12:00:03 - INFO - Executing ZAP...
2026-02-15 12:00:04 - INFO - ZAP executed successfully
2026-02-15 12:00:04 - INFO - Liquidity added successfully
```

## SDK Requirements

Your SDK must provide the following functions:

- `get_positions(wallet_address)` - Get all positions for a wallet
- `remove_liquidity(position_id, liquidity_percentage)` - Remove liquidity
- `calculate_range_from_current_tick(current_tick, tick_spacing)` - Calculate new range
- `zap_liquidity(...)` - ZAP tokens for new position
- `add_liquidity_from_zap(zap_output, lower_tick, upper_tick)` - Add liquidity

## Configuration

Edit `config.py` to set:

- `WALLET_ADDRESS`: Your wallet address
- `RPC_URL`: Blockchain RPC endpoint
- `POOL_ADDRESS`: The pool to monitor
- `TICK_SPACING`: Pool tick spacing
- `CHECK_INTERVAL_SECONDS`: How often to check (default: 300 seconds)

## Error Handling

The bot handles errors gracefully:

- If getting positions fails, returns empty list and logs error
- If removing liquidity fails, logs error and skips position
- If zap fails, aborts safely and logs error
- If adding liquidity fails, logs error and returns failure

## Architecture

```
rebalance_bot.py       # Main bot logic
config.py              # Configuration settings
requirements.txt       # Python dependencies
README.md             # This file
Rebalance Bot         # Specification document
```

## Contributing

This bot follows a simple, no-calculations approach. When contributing:

- Do NOT add manual calculations
- Do NOT force token ratios
- Do NOT bypass SDK zap functions
- Keep logging simple and clear
- Follow the existing code style

## License

[Add your license here]

## Support

For issues or questions, please open an issue on GitHub.
