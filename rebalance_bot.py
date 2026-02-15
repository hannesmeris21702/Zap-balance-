"""
Simple ZAP-Based Rebalance Bot

This bot follows a simple logic flow without custom calculations or math.
It relies on SDK zap functions for token swaps and liquidity management.
"""

import logging
from typing import List, Dict, Any, Tuple
from dataclasses import dataclass
from enum import Enum


# Configure simple logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class PositionStatus(Enum):
    """Position status enumeration"""
    IN_RANGE = "IN_RANGE"
    OUT_OF_RANGE = "OUT_OF_RANGE"


@dataclass
class Position:
    """Represents a liquidity position"""
    position_id: str
    lower_tick: int
    upper_tick: int
    liquidity: int
    token0: str
    token1: str


@dataclass
class ClosedPositionResult:
    """Result from closing a position"""
    token0_amount: int
    token1_amount: int
    total_value: float
    token0_address: str
    token1_address: str


class RebalanceBot:
    """
    Simple ZAP-based rebalance bot.
    
    This bot checks positions for range status and rebalances using SDK zap functions.
    No manual calculations or custom math - follows the simple logic flow.
    """
    
    def __init__(self, wallet_address: str, sdk_client):
        """
        Initialize the rebalance bot.
        
        Args:
            wallet_address: The wallet address to monitor
            sdk_client: SDK client with zap and liquidity functions
        """
        self.wallet_address = wallet_address
        self.sdk = sdk_client
        logger.info(f"RebalanceBot initialized for wallet: {wallet_address}")
    
    def check_position_status(self, position: Position, current_tick: int) -> PositionStatus:
        """
        Check if a position is in range or out of range.
        
        Args:
            position: The position to check
            current_tick: Current market tick
            
        Returns:
            PositionStatus: IN_RANGE or OUT_OF_RANGE
        """
        if position.lower_tick <= current_tick <= position.upper_tick:
            return PositionStatus.IN_RANGE
        return PositionStatus.OUT_OF_RANGE
    
    def get_wallet_positions(self) -> List[Position]:
        """
        Check wallet for positions with liquidity.
        
        Returns:
            List of positions with liquidity
        """
        try:
            positions = self.sdk.get_positions(self.wallet_address)
            # Filter positions with liquidity > 0
            return [pos for pos in positions if pos.liquidity > 0]
        except Exception as e:
            logger.error(f"Error getting wallet positions: {e}")
            return []
    
    def remove_liquidity(self, position: Position) -> ClosedPositionResult:
        """
        Remove 100% liquidity from a position and close it.
        
        Args:
            position: The position to close
            
        Returns:
            ClosedPositionResult with returned tokens and total value
        """
        try:
            # Remove 100% liquidity
            result = self.sdk.remove_liquidity(
                position_id=position.position_id,
                liquidity_percentage=100
            )
            
            closed_result = ClosedPositionResult(
                token0_amount=result['token0_amount'],
                token1_amount=result['token1_amount'],
                total_value=result['total_value'],
                token0_address=position.token0,
                token1_address=position.token1
            )
            
            logger.info(f"Liquidity removed from position {position.position_id}")
            logger.info(f"Returned: {closed_result.token0_amount} token0, {closed_result.token1_amount} token1")
            logger.info(f"Total value: {closed_result.total_value}")
            
            return closed_result
        except Exception as e:
            logger.error(f"Error removing liquidity from position {position.position_id}: {e}")
            raise
    
    def determine_new_range(self, current_tick: int, tick_spacing: int) -> Tuple[int, int]:
        """
        Determine new active range based on current price.
        
        Args:
            current_tick: Current market tick
            tick_spacing: Tick spacing for the pool
            
        Returns:
            Tuple of (lower_tick, upper_tick) for new range
        """
        # Use SDK helper to determine appropriate range based on current tick
        new_range = self.sdk.calculate_range_from_current_tick(
            current_tick=current_tick,
            tick_spacing=tick_spacing
        )
        
        logger.info(f"New range determined: [{new_range['lower_tick']}, {new_range['upper_tick']}]")
        return new_range['lower_tick'], new_range['upper_tick']
    
    def zap_and_add_liquidity(
        self,
        closed_position: ClosedPositionResult,
        lower_tick: int,
        upper_tick: int,
        current_tick: int
    ) -> bool:
        """
        ZAP liquidity and add to new position.
        
        Uses SDK zap function for the new range. Input tokens and value come from
        closed position. SDK decides swap internally. No manual ratio calculations.
        
        Args:
            closed_position: Result from closing the out-of-range position
            lower_tick: Lower tick for new position
            upper_tick: Upper tick for new position
            current_tick: Current market tick
            
        Returns:
            bool: True if successful, False if failed
        """
        try:
            # ZAP liquidity using SDK function
            # Input tokens = tokens returned from close_position
            # Input value = total value returned from close_position
            # Let SDK decide swap internally
            logger.info("Executing ZAP...")
            
            zap_result = self.sdk.zap_liquidity(
                token0_address=closed_position.token0_address,
                token1_address=closed_position.token1_address,
                token0_amount=closed_position.token0_amount,
                token1_amount=closed_position.token1_amount,
                total_value=closed_position.total_value,
                lower_tick=lower_tick,
                upper_tick=upper_tick,
                current_tick=current_tick
            )
            
            logger.info("ZAP executed successfully")
            
            # Add liquidity using zap output
            # Amount added MUST equal closed position value
            add_result = self.sdk.add_liquidity_from_zap(
                zap_output=zap_result,
                lower_tick=lower_tick,
                upper_tick=upper_tick
            )
            
            logger.info(f"Liquidity added successfully. Position ID: {add_result.get('position_id')}")
            logger.info(f"Value added: {add_result.get('value_added')}")
            
            return True
            
        except Exception as e:
            logger.error(f"ZAP or add liquidity failed: {e}")
            logger.error("Aborting safely")
            return False
    
    def process_position(self, position: Position, current_tick: int, tick_spacing: int) -> bool:
        """
        Process a single position - check range and rebalance if needed.
        
        Args:
            position: The position to process
            current_tick: Current market tick
            tick_spacing: Tick spacing for the pool
            
        Returns:
            bool: True if position was rebalanced, False otherwise
        """
        # Check if current price is inside the position range
        status = self.check_position_status(position, current_tick)
        logger.info(f"Position {position.position_id} status: {status.value}")
        
        if status == PositionStatus.IN_RANGE:
            # Do nothing - continue monitoring
            logger.info(f"Position {position.position_id} is IN_RANGE - no action needed")
            return False
        
        # Position is OUT_OF_RANGE
        logger.info(f"Position {position.position_id} is OUT_OF_RANGE - rebalancing...")
        
        # Remove 100% liquidity and close the position
        closed_position = self.remove_liquidity(position)
        
        # Determine new active range based on current price
        lower_tick, upper_tick = self.determine_new_range(current_tick, tick_spacing)
        
        # ZAP liquidity and add to new position
        success = self.zap_and_add_liquidity(
            closed_position=closed_position,
            lower_tick=lower_tick,
            upper_tick=upper_tick,
            current_tick=current_tick
        )
        
        if success:
            logger.info(f"Successfully rebalanced position {position.position_id}")
        else:
            logger.error(f"Failed to rebalance position {position.position_id}")
        
        return success
    
    def run_rebalance_check(self, current_tick: int, tick_spacing: int) -> Dict[str, Any]:
        """
        Main rebalance logic - check all positions and rebalance if needed.
        
        Args:
            current_tick: Current market tick
            tick_spacing: Tick spacing for the pool
            
        Returns:
            Dictionary with rebalance results
        """
        logger.info("=" * 50)
        logger.info("Starting rebalance check...")
        logger.info("=" * 50)
        
        # Step 1: Check wallet for positions with liquidity
        positions = self.get_wallet_positions()
        logger.info(f"Found {len(positions)} positions with liquidity")
        
        if not positions:
            logger.info("No positions to check")
            return {"positions_checked": 0, "positions_rebalanced": 0}
        
        # Step 2: For each position, check range and rebalance if needed
        rebalanced_count = 0
        for position in positions:
            logger.info("-" * 50)
            try:
                was_rebalanced = self.process_position(position, current_tick, tick_spacing)
                if was_rebalanced:
                    rebalanced_count += 1
            except Exception as e:
                logger.error(f"Error processing position {position.position_id}: {e}")
                continue
        
        logger.info("=" * 50)
        logger.info(f"Rebalance check complete. Rebalanced {rebalanced_count}/{len(positions)} positions")
        logger.info("=" * 50)
        
        return {
            "positions_checked": len(positions),
            "positions_rebalanced": rebalanced_count
        }


def main():
    """
    Main entry point for the rebalance bot.
    
    Note: This is a template. You need to provide:
    - wallet_address: Your wallet address
    - sdk_client: Initialized SDK client with zap functionality
    - current_tick: Current market tick
    - tick_spacing: Pool tick spacing
    """
    # Example usage (replace with actual values):
    # wallet_address = "0x..."
    # sdk_client = YourSDKClient()
    # bot = RebalanceBot(wallet_address, sdk_client)
    # bot.run_rebalance_check(current_tick=12345, tick_spacing=60)
    
    logger.info("Rebalance bot module loaded")
    logger.info("Initialize with wallet_address and sdk_client to use")


if __name__ == "__main__":
    main()
