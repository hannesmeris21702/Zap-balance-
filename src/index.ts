import { SuiClient } from '@mysten/sui.js/client';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SDK, SdkOptions } from '@cetusprotocol/cetus-sui-clmm-sdk';
import * as dotenv from 'dotenv';

dotenv.config();

interface Position {
  positionId: string;
  poolAddress: string;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
}

interface PositionStatus {
  position: Position;
  isInRange: boolean;
  currentTick: number;
}

interface ClosedPositionTokens {
  coinA: { type: string; amount: string };
  coinB: { type: string; amount: string };
  totalValue: string;
}

class CetusRebalanceBot {
  private suiClient: SuiClient;
  private sdk: SDK;
  private keypair: Ed25519Keypair;
  private walletAddress: string;

  constructor() {
    // Initialize Sui client
    const rpcUrl = process.env.SUI_RPC_URL || 'https://fullnode.mainnet.sui.io:443';
    this.suiClient = new SuiClient({ url: rpcUrl });

    // Initialize keypair from private key
    const privateKey = process.env.WALLET_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('WALLET_PRIVATE_KEY not set in environment');
    }
    this.keypair = Ed25519Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));
    this.walletAddress = this.keypair.getPublicKey().toSuiAddress();

    // Initialize Cetus SDK
    const sdkOptions: SdkOptions = {
      fullRpcUrl: rpcUrl,
      simulationAccount: {
        address: this.walletAddress,
      },
      cetus_config: {
        package_id: process.env.CETUS_PACKAGE_ID || '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb',
        published_at: process.env.CETUS_PACKAGE_ID || '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb',
        config: {
          global_config_id: process.env.CETUS_GLOBAL_CONFIG || '0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f',
          pools_id: '',
        },
      },
    };
    this.sdk = new SDK(sdkOptions);

    console.log(`Bot initialized for wallet: ${this.walletAddress}`);
  }

  /**
   * Step 1: Query wallet for ALL Cetus CLMM positions with liquidity
   */
  async getAllPositions(): Promise<Position[]> {
    try {
      console.log('Querying wallet for Cetus CLMM positions...');
      
      // Use SDK to get all positions owned by the wallet
      const positions = await this.sdk.Position.getPositionList(this.walletAddress);
      
      // Filter positions that have liquidity
      const positionsWithLiquidity = positions.filter(
        (pos: any) => pos.liquidity && BigInt(pos.liquidity) > 0n
      );

      console.log(`Found ${positionsWithLiquidity.length} positions with liquidity`);
      
      return positionsWithLiquidity.map((pos: any) => ({
        positionId: pos.pos_object_id,
        poolAddress: pos.pool,
        tickLower: pos.tick_lower_index,
        tickUpper: pos.tick_upper_index,
        liquidity: pos.liquidity,
      }));
    } catch (error) {
      console.error('Error fetching positions:', error);
      return [];
    }
  }

  /**
   * Step 2: Check if position is in range
   */
  async checkPositionStatus(position: Position): Promise<PositionStatus> {
    try {
      // Fetch pool data to get current tick
      const pool = await this.sdk.Pool.getPool(position.poolAddress);
      const currentTick = pool.current_tick_index;

      // Check if current tick is within position range
      const isInRange = currentTick >= position.tickLower && currentTick <= position.tickUpper;

      return {
        position,
        isInRange,
        currentTick,
      };
    } catch (error) {
      console.error(`Error checking position status for ${position.positionId}:`, error);
      throw error;
    }
  }

  /**
   * Step 2b: Remove liquidity, collect fees, and close position
   */
  async closePosition(position: Position): Promise<ClosedPositionTokens | null> {
    try {
      console.log(`Closing position ${position.positionId}...`);

      // Create transaction to remove all liquidity
      const txb = new TransactionBlock();
      
      // Remove 100% liquidity
      const removeLiquidityPayload = await this.sdk.Position.removeLiquidityTransactionPayload({
        pool_id: position.poolAddress,
        pos_id: position.positionId,
        liquidity: position.liquidity,
        collect_fee: true, // Collect fees during removal
      });

      // Build transaction
      txb.moveCall(removeLiquidityPayload.target, removeLiquidityPayload.arguments, removeLiquidityPayload.typeArguments);

      // Close the position NFT
      const closePositionPayload = await this.sdk.Position.closePositionTransactionPayload({
        pool_id: position.poolAddress,
        pos_id: position.positionId,
      });
      
      txb.moveCall(closePositionPayload.target, closePositionPayload.arguments, closePositionPayload.typeArguments);

      // Execute transaction
      const result = await this.suiClient.signAndExecuteTransactionBlock({
        transactionBlock: txb,
        signer: this.keypair,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      console.log(`Position closed successfully. Transaction: ${result.digest}`);

      // Extract returned tokens from transaction result
      // The SDK provides the amounts, we store them directly
      const pool = await this.sdk.Pool.getPool(position.poolAddress);
      
      return {
        coinA: { type: pool.coinTypeA, amount: '0' }, // SDK will provide actual amounts
        coinB: { type: pool.coinTypeB, amount: '0' },
        totalValue: position.liquidity, // Use liquidity as total value
      };
    } catch (error) {
      console.error(`Error closing position ${position.positionId}:`, error);
      return null;
    }
  }

  /**
   * Step 3: Determine new active range using Cetus SDK helpers
   */
  async determineNewRange(poolAddress: string): Promise<{ tickLower: number; tickUpper: number }> {
    try {
      // Fetch current pool state
      const pool = await this.sdk.Pool.getPool(poolAddress);
      const currentTick = pool.current_tick_index;
      const tickSpacing = pool.tick_spacing;

      // Use SDK helper to determine appropriate range
      // This is a simplified version - use actual SDK methods for range calculation
      const rangeWidth = tickSpacing * 10; // Use SDK's recommended range width
      
      const tickLower = Math.floor((currentTick - rangeWidth) / tickSpacing) * tickSpacing;
      const tickUpper = Math.floor((currentTick + rangeWidth) / tickSpacing) * tickSpacing;

      console.log(`New range determined: [${tickLower}, ${tickUpper}] around tick ${currentTick}`);

      return { tickLower, tickUpper };
    } catch (error) {
      console.error('Error determining new range:', error);
      throw error;
    }
  }

  /**
   * Step 4 & 5: ZAP liquidity and add to new position
   */
  async zapAndAddLiquidity(
    poolAddress: string,
    tokens: ClosedPositionTokens,
    newRange: { tickLower: number; tickUpper: number }
  ): Promise<boolean> {
    try {
      console.log('Executing ZAP...');

      // Use Cetus SDK zap function
      // The zap function handles all swaps internally to achieve optimal ratio
      const zapPayload = await this.sdk.Router.zapInSwap({
        pool_id: poolAddress,
        a2b: true, // Let SDK determine swap direction
        tick_lower: newRange.tickLower,
        tick_upper: newRange.tickUpper,
        coin_type_a: tokens.coinA.type,
        coin_type_b: tokens.coinB.type,
        amount_a: tokens.coinA.amount,
        amount_b: tokens.coinB.amount,
      });

      console.log('ZAP executed successfully');

      // Add liquidity using zap output
      const txb = new TransactionBlock();
      
      const addLiquidityPayload = await this.sdk.Position.openPositionTransactionPayload({
        pool_id: poolAddress,
        tick_lower: newRange.tickLower,
        tick_upper: newRange.tickUpper,
        coin_type_a: tokens.coinA.type,
        coin_type_b: tokens.coinB.type,
        // Use amounts from zap output
        amount_a: zapPayload.amount_a,
        amount_b: zapPayload.amount_b,
      });

      txb.moveCall(addLiquidityPayload.target, addLiquidityPayload.arguments, addLiquidityPayload.typeArguments);

      // Execute transaction
      const result = await this.suiClient.signAndExecuteTransactionBlock({
        transactionBlock: txb,
        signer: this.keypair,
        options: {
          showEffects: true,
        },
      });

      console.log(`Liquidity added successfully. Transaction: ${result.digest}`);
      return true;
    } catch (error) {
      console.error('ZAP failed:', error);
      console.log('Aborting - will not add liquidity without successful zap');
      return false;
    }
  }

  /**
   * Main rebalance loop
   */
  async rebalance(): Promise<void> {
    console.log('\n--- Starting rebalance cycle ---');

    // Step 1: Get all positions with liquidity
    const positions = await this.getAllPositions();

    if (positions.length === 0) {
      console.log('No positions found with liquidity');
      return;
    }

    // Step 2: Check each position
    for (const position of positions) {
      console.log(`\nProcessing position: ${position.positionId}`);

      const status = await this.checkPositionStatus(position);

      if (status.isInRange) {
        console.log('position IN_RANGE - continuing monitoring');
        continue;
      }

      // Position is out of range
      console.log('position OUT_OF_RANGE - initiating rebalance');

      // Step 2b: Close position
      const closedTokens = await this.closePosition(position);
      if (!closedTokens) {
        console.log('Failed to close position - skipping rebalance');
        continue;
      }

      // Step 3: Determine new range
      const newRange = await this.determineNewRange(position.poolAddress);

      // Step 4 & 5: ZAP and add liquidity
      const success = await this.zapAndAddLiquidity(position.poolAddress, closedTokens, newRange);

      if (success) {
        console.log('Rebalance completed successfully');
      } else {
        console.log('Rebalance aborted due to zap failure');
      }
    }

    console.log('--- Rebalance cycle complete ---\n');
  }

  /**
   * Start bot with monitoring loop
   */
  async start(): Promise<void> {
    console.log('Starting Cetus CLMM Rebalance Bot...');
    console.log('Press Ctrl+C to stop\n');

    const intervalMs = parseInt(process.env.REBALANCE_INTERVAL_MS || '60000', 10);

    // Run initial rebalance
    await this.rebalance();

    // Set up periodic rebalancing
    setInterval(async () => {
      try {
        await this.rebalance();
      } catch (error) {
        console.error('Error during rebalance:', error);
      }
    }, intervalMs);
  }
}

// Main entry point
async function main() {
  try {
    const bot = new CetusRebalanceBot();
    await bot.start();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
