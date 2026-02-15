"""
Simple tests for the Rebalance Bot

These tests verify the core logic flow without requiring actual blockchain interaction.
"""

import unittest
from unittest.mock import Mock, MagicMock, patch
from dataclasses import dataclass
from rebalance_bot import (
    RebalanceBot,
    Position,
    PositionStatus,
    ClosedPositionResult
)


class TestRebalanceBot(unittest.TestCase):
    """Test cases for RebalanceBot"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.wallet_address = "0x1234567890123456789012345678901234567890"
        self.mock_sdk = Mock()
        self.bot = RebalanceBot(self.wallet_address, self.mock_sdk)
    
    def test_check_position_status_in_range(self):
        """Test position status check when position is IN_RANGE"""
        position = Position(
            position_id="test_pos_1",
            lower_tick=100,
            upper_tick=200,
            liquidity=1000,
            token0="0xtoken0",
            token1="0xtoken1"
        )
        
        # Current tick is within range
        status = self.bot.check_position_status(position, current_tick=150)
        self.assertEqual(status, PositionStatus.IN_RANGE)
        
        # Current tick at lower bound
        status = self.bot.check_position_status(position, current_tick=100)
        self.assertEqual(status, PositionStatus.IN_RANGE)
        
        # Current tick at upper bound
        status = self.bot.check_position_status(position, current_tick=200)
        self.assertEqual(status, PositionStatus.IN_RANGE)
    
    def test_check_position_status_out_of_range(self):
        """Test position status check when position is OUT_OF_RANGE"""
        position = Position(
            position_id="test_pos_1",
            lower_tick=100,
            upper_tick=200,
            liquidity=1000,
            token0="0xtoken0",
            token1="0xtoken1"
        )
        
        # Current tick below range
        status = self.bot.check_position_status(position, current_tick=50)
        self.assertEqual(status, PositionStatus.OUT_OF_RANGE)
        
        # Current tick above range
        status = self.bot.check_position_status(position, current_tick=250)
        self.assertEqual(status, PositionStatus.OUT_OF_RANGE)
    
    def test_get_wallet_positions_filters_empty_liquidity(self):
        """Test that positions with zero liquidity are filtered out"""
        mock_positions = [
            Position("pos1", 100, 200, 1000, "0xtoken0", "0xtoken1"),
            Position("pos2", 100, 200, 0, "0xtoken0", "0xtoken1"),  # Empty
            Position("pos3", 100, 200, 500, "0xtoken0", "0xtoken1"),
        ]
        self.mock_sdk.get_positions.return_value = mock_positions
        
        positions = self.bot.get_wallet_positions()
        
        # Should return only positions with liquidity > 0
        self.assertEqual(len(positions), 2)
        self.assertEqual(positions[0].position_id, "pos1")
        self.assertEqual(positions[1].position_id, "pos3")
    
    def test_remove_liquidity_returns_correct_result(self):
        """Test that remove_liquidity correctly processes SDK response"""
        position = Position(
            position_id="test_pos_1",
            lower_tick=100,
            upper_tick=200,
            liquidity=1000,
            token0="0xtoken0",
            token1="0xtoken1"
        )
        
        self.mock_sdk.remove_liquidity.return_value = {
            'token0_amount': 100,
            'token1_amount': 200,
            'total_value': 300.5
        }
        
        result = self.bot.remove_liquidity(position)
        
        self.assertEqual(result.token0_amount, 100)
        self.assertEqual(result.token1_amount, 200)
        self.assertEqual(result.total_value, 300.5)
        self.assertEqual(result.token0_address, "0xtoken0")
        self.assertEqual(result.token1_address, "0xtoken1")
        
        # Verify SDK was called with correct parameters
        self.mock_sdk.remove_liquidity.assert_called_once_with(
            position_id="test_pos_1",
            liquidity_percentage=100
        )
    
    def test_determine_new_range_uses_sdk(self):
        """Test that new range is determined using SDK function"""
        self.mock_sdk.calculate_range_from_current_tick.return_value = {
            'lower_tick': 1000,
            'upper_tick': 2000
        }
        
        lower, upper = self.bot.determine_new_range(current_tick=1500, tick_spacing=60)
        
        self.assertEqual(lower, 1000)
        self.assertEqual(upper, 2000)
        self.mock_sdk.calculate_range_from_current_tick.assert_called_once_with(
            current_tick=1500,
            tick_spacing=60
        )
    
    def test_zap_and_add_liquidity_success(self):
        """Test successful zap and add liquidity flow"""
        closed_position = ClosedPositionResult(
            token0_amount=100,
            token1_amount=200,
            total_value=300.0,
            token0_address="0xtoken0",
            token1_address="0xtoken1"
        )
        
        # Mock successful zap
        self.mock_sdk.zap_liquidity.return_value = {"zap_data": "test"}
        self.mock_sdk.add_liquidity_from_zap.return_value = {
            "position_id": "new_pos",
            "value_added": 300.0
        }
        
        result = self.bot.zap_and_add_liquidity(
            closed_position=closed_position,
            lower_tick=1000,
            upper_tick=2000,
            current_tick=1500
        )
        
        self.assertTrue(result)
        
        # Verify zap was called with correct parameters
        self.mock_sdk.zap_liquidity.assert_called_once()
        call_args = self.mock_sdk.zap_liquidity.call_args[1]
        self.assertEqual(call_args['token0_amount'], 100)
        self.assertEqual(call_args['token1_amount'], 200)
        self.assertEqual(call_args['total_value'], 300.0)
        
        # Verify add_liquidity was called
        self.mock_sdk.add_liquidity_from_zap.assert_called_once()
    
    def test_zap_and_add_liquidity_failure(self):
        """Test that zap failure is handled gracefully"""
        closed_position = ClosedPositionResult(
            token0_amount=100,
            token1_amount=200,
            total_value=300.0,
            token0_address="0xtoken0",
            token1_address="0xtoken1"
        )
        
        # Mock zap failure
        self.mock_sdk.zap_liquidity.side_effect = Exception("ZAP failed")
        
        result = self.bot.zap_and_add_liquidity(
            closed_position=closed_position,
            lower_tick=1000,
            upper_tick=2000,
            current_tick=1500
        )
        
        # Should return False and not crash
        self.assertFalse(result)
    
    def test_process_position_in_range_no_action(self):
        """Test that IN_RANGE positions are not rebalanced"""
        position = Position(
            position_id="test_pos_1",
            lower_tick=100,
            upper_tick=200,
            liquidity=1000,
            token0="0xtoken0",
            token1="0xtoken1"
        )
        
        # Position is in range
        result = self.bot.process_position(position, current_tick=150, tick_spacing=60)
        
        # Should return False (not rebalanced)
        self.assertFalse(result)
        
        # SDK functions should not be called
        self.mock_sdk.remove_liquidity.assert_not_called()
        self.mock_sdk.zap_liquidity.assert_not_called()
    
    def test_process_position_out_of_range_rebalances(self):
        """Test that OUT_OF_RANGE positions are rebalanced"""
        position = Position(
            position_id="test_pos_1",
            lower_tick=100,
            upper_tick=200,
            liquidity=1000,
            token0="0xtoken0",
            token1="0xtoken1"
        )
        
        # Mock SDK responses
        self.mock_sdk.remove_liquidity.return_value = {
            'token0_amount': 100,
            'token1_amount': 200,
            'total_value': 300.0
        }
        self.mock_sdk.calculate_range_from_current_tick.return_value = {
            'lower_tick': 1000,
            'upper_tick': 2000
        }
        self.mock_sdk.zap_liquidity.return_value = {"zap_data": "test"}
        self.mock_sdk.add_liquidity_from_zap.return_value = {
            "position_id": "new_pos",
            "value_added": 300.0
        }
        
        # Position is out of range (current tick below range)
        result = self.bot.process_position(position, current_tick=50, tick_spacing=60)
        
        # Should return True (rebalanced)
        self.assertTrue(result)
        
        # Verify all SDK functions were called
        self.mock_sdk.remove_liquidity.assert_called_once()
        self.mock_sdk.calculate_range_from_current_tick.assert_called_once()
        self.mock_sdk.zap_liquidity.assert_called_once()
        self.mock_sdk.add_liquidity_from_zap.assert_called_once()
    
    def test_run_rebalance_check_no_positions(self):
        """Test rebalance check with no positions"""
        self.mock_sdk.get_positions.return_value = []
        
        result = self.bot.run_rebalance_check(current_tick=1500, tick_spacing=60)
        
        self.assertEqual(result['positions_checked'], 0)
        self.assertEqual(result['positions_rebalanced'], 0)
    
    def test_run_rebalance_check_with_positions(self):
        """Test rebalance check with multiple positions"""
        mock_positions = [
            Position("pos1", 100, 200, 1000, "0xtoken0", "0xtoken1"),  # Will be in range
            Position("pos2", 100, 200, 1000, "0xtoken0", "0xtoken1"),  # Will be out of range
            Position("pos3", 100, 200, 1000, "0xtoken0", "0xtoken1"),  # Will be in range
        ]
        self.mock_sdk.get_positions.return_value = mock_positions
        
        # Mock SDK responses for rebalancing
        self.mock_sdk.remove_liquidity.return_value = {
            'token0_amount': 100,
            'token1_amount': 200,
            'total_value': 300.0
        }
        self.mock_sdk.calculate_range_from_current_tick.return_value = {
            'lower_tick': 1000,
            'upper_tick': 2000
        }
        self.mock_sdk.zap_liquidity.return_value = {"zap_data": "test"}
        self.mock_sdk.add_liquidity_from_zap.return_value = {
            "position_id": "new_pos",
            "value_added": 300.0
        }
        
        # Current tick is 150 (in range for pos1 and pos3, would be in range for pos2 too)
        # Let's test with current tick that makes pos2 out of range
        # We need to use a current_tick that's out of range for pos2
        result = self.bot.run_rebalance_check(current_tick=50, tick_spacing=60)
        
        # All positions should be checked
        self.assertEqual(result['positions_checked'], 3)
        # All positions should be out of range with current_tick=50
        self.assertEqual(result['positions_rebalanced'], 3)


if __name__ == '__main__':
    unittest.main()
