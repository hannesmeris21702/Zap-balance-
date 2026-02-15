"""
Configuration for Rebalance Bot

This file contains configuration settings for the bot.
Modify these values according to your environment.
"""

# Wallet Configuration
WALLET_ADDRESS = ""  # Your wallet address

# Network Configuration
RPC_URL = ""  # RPC endpoint for the blockchain
CHAIN_ID = 1  # Chain ID (1 for Ethereum mainnet, etc.)

# Pool Configuration
POOL_ADDRESS = ""  # The liquidity pool address to monitor
TICK_SPACING = 60  # Tick spacing for the pool (typically 10, 60, or 200)

# Bot Configuration
CHECK_INTERVAL_SECONDS = 300  # How often to check positions (default: 5 minutes)

# Logging Configuration
LOG_LEVEL = "INFO"  # Logging level (DEBUG, INFO, WARNING, ERROR)
LOG_FILE = "rebalance_bot.log"  # Log file name (optional)

# SDK Configuration
# Add any SDK-specific configuration here
SDK_CONFIG = {
    # Example SDK settings
    "timeout": 30,
    "max_retries": 3,
}
