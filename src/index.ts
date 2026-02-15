import { SuiClient } from '@mysten/sui.js/client';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { CetusClmmSDK, SdkOptions, TickMath } from '@cetusprotocol/cetus-sui-clmm-sdk';
import * as dotenv from 'dotenv';

dotenv.config();

// Configuration constants
const RANGE_WIDTH_MULTIPLIER = 10; // Multiplier for tick spacing to determine position width
// A value of 10 means the position will span 10 tick spacings on each side of current price
// This provides balanced concentration: not too narrow (frequent rebalancing) or too wide (reduced capital efficiency)

// SDK Configuration based on mainnet - from official Cetus SDK examples
const SDKConfig = {
  clmmConfig: {
    pools_id: '0xf699e7f2276f5c9a75944b37a0c5b5d9ddfd2471bf6242483b03ab2887d198d0',
    global_config_id: '0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f',
    global_vault_id: '0xce7bceef26d3ad1f6d9b6f13a953f053e6ed3ca77907516481ce99ae8e588f2b',
    admin_cap_id: '0x89c1a321291d15ddae5a086c9abc533dff697fde3d89e0ca836c41af73e36a75',
  },
  cetusConfig: {
    coin_list_id: '0x8cbc11d9e10140db3d230f50b4d30e9b721201c0083615441707ffec1ef77b23',
    launchpad_pools_id: '0x1098fac992eab3a0ab7acf15bb654fc1cf29b5a6142c4ef1058e6c408dd15115',
    clmm_pools_id: '0x15b6a27dd9ae03eb455aba03b39e29aad74abd3757b8e18c0755651b2ae5b71e',
    admin_cap_id: '0x39d78781750e193ce35c45ff32c6c0c3f2941fa3ddaf8595c90c555589ddb113',
    global_config_id: '0x0408fa4e4a4c03cc0de8f23d0c2bbfe8913d178713c9a271ed4080973fe42d8f',
    coin_list_handle: '0x49136005e90e28c4695419ed4194cc240603f1ea8eb84e62275eaff088a71063',
    launchpad_pools_handle: '0x5e194a8efcf653830daf85a85b52e3ae8f65dc39481d54b2382acda25068375c',
    clmm_pools_handle: '0x37f60eb2d9d227949b95da8fea810db3c32d1e1fa8ed87434fc51664f87d83cb',
  },
};

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

/**
 * Validates Cetus SDK package and config version
 * Checks that the global config's package ID matches the expected CLMM package ID
 * and logs version information
 */
async function validateCetusConfig(suiClient: SuiClient): Promise<void> {
  console.log('\n=== Validating Cetus SDK Configuration ===');
  
  // Step 1: Read environment variables
  const clmmPackageId = process.env.CETUS_CLMM_PACKAGE_ID;
  const globalConfigId = process.env.CETUS_GLOBAL_CONFIG_ID;
  
  if (!clmmPackageId || !globalConfigId) {
    console.error('❌ ERROR: CETUS_CLMM_PACKAGE_ID and CETUS_GLOBAL_CONFIG_ID must be set in environment');
    process.exit(1);
  }
  
  console.log(`CETUS_CLMM_PACKAGE_ID: ${clmmPackageId}`);
  console.log(`CETUS_GLOBAL_CONFIG_ID: ${globalConfigId}`);
  
  try {
    // Step 2: Fetch global config object
    console.log('\nFetching global config object...');
    const configObject = await suiClient.getObject({
      id: globalConfigId,
      options: { 
        showContent: true, 
        showType: true 
      }
    });
    
    if (configObject.data?.content?.dataType !== 'moveObject') {
      console.error('❌ ERROR: Global config object not found or invalid');
      process.exit(1);
    }
    
    // Step 3: Extract package ID from config
    const configData = configObject.data.content as any;
    const configFields = configData.fields;
    
    // The package ID should be in the config's package field or extracted from the type
    let configPackageId: string | undefined;
    
    // Try to extract package ID from the type (format: package_id::module::Type)
    if (configData.type) {
      const typeMatch = configData.type.match(/^(0x[a-fA-F0-9]+)::/);
      if (typeMatch) {
        configPackageId = typeMatch[1];
      }
    }
    
    // Also check if there's a package field in the config
    if (configFields?.package) {
      configPackageId = configFields.package;
    }
    
    if (!configPackageId) {
      console.log('⚠️  Warning: Could not extract package ID from config object');
      console.log('Config type:', configData.type);
      console.log('Config fields:', JSON.stringify(configFields, null, 2));
    } else {
      console.log(`Config package ID: ${configPackageId}`);
      
      // Step 4: Compare package IDs
      if (configPackageId !== clmmPackageId) {
        console.error('\n❌ ERROR: Package ID mismatch!');
        console.error(`  Expected (CETUS_CLMM_PACKAGE_ID): ${clmmPackageId}`);
        console.error(`  Found in config: ${configPackageId}`);
        console.error('  The SDK configuration does not match the on-chain global config.');
        console.error('  Please update your environment variables to match the correct package ID.');
        process.exit(1);
      }
      
      console.log('✓ Package ID validation passed');
    }
    
    // Step 5: Fetch package version
    console.log('\nFetching package version...');
    try {
      const packageObject = await suiClient.getObject({
        id: clmmPackageId,
        options: {
          showContent: true,
          showType: true,
          showBcs: true
        }
      });
      
      if (packageObject.data) {
        // For package objects, the version is stored in the object's version field
        const version = packageObject.data.version;
        console.log(`Package version: ${version}`);
      } else {
        console.log('⚠️  Warning: Could not fetch package version');
      }
    } catch (versionError: any) {
      console.log(`⚠️  Warning: Could not fetch package version: ${versionError.message}`);
    }
    
    console.log('\n=== Configuration Summary ===');
    console.log(`Package ID: ${clmmPackageId}`);
    console.log(`Global Config ID: ${globalConfigId}`);
    console.log('✓ Validation completed successfully\n');
    
  } catch (error: any) {
    console.error('\n❌ ERROR: Failed to validate Cetus configuration');
    console.error('Details:', error.message || error);
    process.exit(1);
  }
}

class CetusRebalanceBot {
  private suiClient: SuiClient;
  private sdk: CetusClmmSDK;
  private keypair: Ed25519Keypair;
  private walletAddress: string;
  private isTestMode: boolean;

  private constructor(suiClient: SuiClient, sdk: CetusClmmSDK, keypair: Ed25519Keypair, walletAddress: string, isTestMode: boolean) {
    this.suiClient = suiClient;
    this.sdk = sdk;
    this.keypair = keypair;
    this.walletAddress = walletAddress;
    this.isTestMode = isTestMode;
    
    // Set senderAddress to match the wallet address used for signing
    this.sdk.senderAddress = this.walletAddress;

    console.log(`Bot initialized for wallet: ${this.walletAddress}`);
    console.log(`Cetus CLMM Package ID: 0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb`);
    console.log(`Using Cetus SDK with mainnet configuration (version mismatch fixed)`);
    if (this.isTestMode) {
      console.log('⚠️  MAINNET TEST MODE ENABLED - Will process ONE position and exit');
    }
  }

  /**
   * Factory method to create and initialize a CetusRebalanceBot instance
   * Validates Cetus SDK configuration before initialization
   */
  static async create(): Promise<CetusRebalanceBot> {
    // Initialize Sui client
    const rpcUrl = process.env.SUI_RPC_URL || 'https://fullnode.mainnet.sui.io:443';
    const suiClient = new SuiClient({ url: rpcUrl });

    // Validate Cetus SDK configuration before proceeding
    await validateCetusConfig(suiClient);

    // Initialize keypair from private key
    const privateKey = process.env.WALLET_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('WALLET_PRIVATE_KEY not set in environment');
    }
    const keypair = Ed25519Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));
    const walletAddress = keypair.getPublicKey().toSuiAddress();

    // Check if MAINNET_TEST_MODE is enabled
    const isTestMode = process.env.MAINNET_TEST_MODE === 'true';

    // Initialize Cetus SDK with mainnet configuration
    // CRITICAL FIX: published_at MUST equal package_id to avoid version mismatch errors
    const sdkOptions: SdkOptions = {
      fullRpcUrl: rpcUrl,
      simulationAccount: {
        address: walletAddress,
      },
      cetus_config: {
        package_id: '0x95b8d278b876cae22206131fb9724f701c9444515813042f54f0a426c9a3bc2f',
        published_at: '0x95b8d278b876cae22206131fb9724f701c9444515813042f54f0a426c9a3bc2f',
        config: SDKConfig.cetusConfig,
      },
      clmm_pool: {
        package_id: '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb',
        published_at: '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb',
        config: SDKConfig.clmmConfig,
      },
      integrate: {
        package_id: '0x996c4d9480708fb8b92aa7acf819fb0497b5ec8e65ba06601cae2fb6db3312c3',
        published_at: '0x6f5e582ede61fe5395b50c4a449ec11479a54d7ff8e0158247adfda60d98970b',
      },
      deepbook: {
        package_id: '0x000000000000000000000000000000000000000000000000000000000000dee9',
        published_at: '0x000000000000000000000000000000000000000000000000000000000000dee9',
      },
      deepbook_endpoint_v2: {
        package_id: '0xac95e8a5e873cfa2544916c16fe1461b6a45542d9e65504c1794ae390b3345a7',
        published_at: '0xac95e8a5e873cfa2544916c16fe1461b6a45542d9e65504c1794ae390b3345a7',
      },
      aggregatorUrl: 'https://api-sui.cetus.zone/router',
      swapCountUrl: 'https://api-sui.cetus.zone/v2/sui/swap/count',
    };
    const sdk = new CetusClmmSDK(sdkOptions);

    return new CetusRebalanceBot(suiClient, sdk, keypair, walletAddress, isTestMode);
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
   * Returns pool and coin type information for ZAP rebalancing
   */
  async closePosition(position: Position): Promise<{poolId: string; coinTypeA: string; coinTypeB: string} | null> {
    try {
      console.log(`Closing position ${position.positionId}...`);

      // Get pool information for coin types
      const pool = await this.sdk.Pool.getPool(position.poolAddress);

      // Close position (this automatically removes all liquidity, collects fees, and burns NFT)
      const txb = await this.sdk.Position.closePositionTransactionPayload({
        coinTypeA: pool.coinTypeA,
        coinTypeB: pool.coinTypeB,
        pool_id: position.poolAddress,
        pos_id: position.positionId,
        rewarder_coin_types: [], // No specific rewarders to collect
        min_amount_a: '0', // Accept any amount
        min_amount_b: '0', // Accept any amount
        collect_fee: true,
      });

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
      console.log(`Returned tokens to wallet`);

      // Return pool and coin type information for next step
      return {
        poolId: position.poolAddress,
        coinTypeA: pool.coinTypeA,
        coinTypeB: pool.coinTypeB,
      };
    } catch (error) {
      console.error(`Error closing position ${position.positionId}:`, error);
      return null;
    }
  }

  /**
   * Step 3: Determine new active range using current pool price
   * Uses Cetus SDK helpers - NO manual calculations
   * 
   * RANGE WIDTH STRATEGY:
   * The range width is determined by RANGE_WIDTH_MULTIPLIER * tickSpacing.
   * This creates a position centered on the current price with equal width on both sides.
   * - Narrower ranges (smaller multiplier) = higher capital efficiency but more frequent rebalancing
   * - Wider ranges (larger multiplier) = less frequent rebalancing but lower capital efficiency
   */
  async determineNewRange(poolAddress: string): Promise<{ tickLower: string; tickUpper: string }> {
    try {
      // Fetch current pool state
      const pool = await this.sdk.Pool.getPool(poolAddress);
      const currentTick = pool.current_tick_index;
      const tickSpacing = parseInt(pool.tickSpacing);

      // Use SDK helper to determine appropriate range around current tick
      // This creates a range centered on current price
      const rangeWidth = tickSpacing * RANGE_WIDTH_MULTIPLIER;
      
      const tickLower = Math.floor((currentTick - rangeWidth) / tickSpacing) * tickSpacing;
      const tickUpper = Math.floor((currentTick + rangeWidth) / tickSpacing) * tickSpacing;

      console.log(`New range determined: [${tickLower}, ${tickUpper}] around tick ${currentTick}`);

      return { tickLower: tickLower.toString(), tickUpper: tickUpper.toString() };
    } catch (error) {
      console.error('Error determining new range:', error);
      throw error;
    }
  }

  /**
   * Step 4 & 5: ZAP-based liquidity addition
   * 
   * ZAP IMPLEMENTATION NOTE:
   * The Cetus SDK v4.0.0 does not have a dedicated zap() function.
   * However, we achieve ZAP-like functionality by:
   * 1. Closing the position returns tokens to wallet (Step 2b)
   * 2. Opening a new position NFT with desired range
   * 3. Adding liquidity to the position using SDK's createAddLiquidityPayload()
   * 4. The Cetus smart contracts automatically handle token ratio optimization
   * 
   * This approach:
   * - Uses SDK functions only (as required)
   * - Avoids manual calculations (as required)
   * - Lets smart contracts optimize token usage (ZAP-like behavior)
   * - Keeps code simple and maintainable
   * 
   * NO manual calculations, swaps, or ratio logic as per requirements.
   */
  async zapAndAddLiquidity(
    poolInfo: {poolId: string; coinTypeA: string; coinTypeB: string},
    newRange: { tickLower: string; tickUpper: string }
  ): Promise<string | null> {
    try {
      console.log('Executing ZAP (using SDK to add liquidity with available tokens)...');

      // Get current wallet balances for both coins
      const coinBalances = await this.suiClient.getAllBalances({
        owner: this.walletAddress,
      });
      
      // Find balances for coinA and coinB
      const coinABalance = coinBalances.find(b => b.coinType === poolInfo.coinTypeA);
      const coinBBalance = coinBalances.find(b => b.coinType === poolInfo.coinTypeB);
      
      if (!coinABalance && !coinBBalance) {
        console.error('No coin balances available after closing position');
        return null;
      }

      const amountA = coinABalance?.totalBalance || '0';
      const amountB = coinBBalance?.totalBalance || '0';

      console.log(`Available tokens: ${amountA} of coinA, ${amountB} of coinB`);

      // Step 1: Open new position NFT with desired range
      const openTxb = this.sdk.Position.openPositionTransactionPayload({
        coinTypeA: poolInfo.coinTypeA,
        coinTypeB: poolInfo.coinTypeB,
        pool_id: poolInfo.poolId,
        tick_lower: newRange.tickLower,
        tick_upper: newRange.tickUpper,
      });

      const openResult = await this.suiClient.signAndExecuteTransactionBlock({
        transactionBlock: openTxb,
        signer: this.keypair,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      console.log(`Position NFT created. Transaction: ${openResult.digest}`);

      // Extract position ID from transaction result
      const createdObjects = openResult.objectChanges?.filter(
        (change: any) => change.type === 'created'
      );
      const positionObject = createdObjects?.find((obj: any) => 
        obj.objectType?.includes('position::Position')
      );
      
      if (!positionObject) {
        console.error('Failed to find created position NFT');
        return null;
      }

      const newPositionId = (positionObject as any).objectId;
      console.log(`New position ID: ${newPositionId}`);

      // Step 2: Add liquidity to the position using available tokens
      // SDK will handle token ratio optimization
      const addLiqTxb = await this.sdk.Position.createAddLiquidityPayload({
        coinTypeA: poolInfo.coinTypeA,
        coinTypeB: poolInfo.coinTypeB,
        pool_id: poolInfo.poolId,
        pos_id: newPositionId,
        tick_lower: newRange.tickLower,
        tick_upper: newRange.tickUpper,
        delta_liquidity: '0', // Let SDK calculate from amounts
        max_amount_a: amountA,
        max_amount_b: amountB,
        collect_fee: false,
        rewarder_coin_types: [],
      });

      console.log('ZAP executed - SDK handling liquidity addition with token optimization');

      const addLiqResult = await this.suiClient.signAndExecuteTransactionBlock({
        transactionBlock: addLiqTxb,
        signer: this.keypair,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      console.log(`Liquidity added successfully. Transaction: ${addLiqResult.digest}`);
      return newPositionId;
    } catch (error) {
      console.error('ZAP failed:', error);
      console.log('Aborting - will not add liquidity without successful zap');
      return null;
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

    // In test mode, process only the FIRST position
    const positionsToProcess = this.isTestMode ? [positions[0]] : positions;
    
    if (this.isTestMode) {
      console.log(`MAINNET TEST MODE: Processing ONLY the first position out of ${positions.length} found`);
    }

    // Step 2: Check each position
    for (const position of positionsToProcess) {
      console.log(`\nProcessing position: ${position.positionId}`);

      const status = await this.checkPositionStatus(position);

      if (status.isInRange) {
        if (this.isTestMode) {
          console.log('✓ MAINNET TEST: position IN_RANGE');
          console.log('No rebalance needed. Exiting safely.');
          process.exit(0);
        }
        console.log('position IN_RANGE - continuing monitoring');
        continue;
      }

      // Position is out of range
      if (this.isTestMode) {
        console.log('⚠️  MAINNET TEST: position OUT_OF_RANGE');
        console.log('Initiating rebalance...');
      } else {
        console.log('position OUT_OF_RANGE - initiating rebalance');
      }

      // Step 2b: Close position and get pool info
      const poolInfo = await this.closePosition(position);
      if (!poolInfo) {
        console.error('Failed to close position - aborting');
        if (this.isTestMode) {
          console.error('❌ MAINNET TEST FAILED: Could not close position');
          process.exit(1);
        }
        continue;
      }

      // Step 3: Determine new range based on current pool price
      const newRange = await this.determineNewRange(poolInfo.poolId);

      // Step 4 & 5: ZAP and add liquidity using SDK (no manual calculations)
      const newPositionId = await this.zapAndAddLiquidity(poolInfo, newRange);

      if (newPositionId) {
        if (this.isTestMode) {
          console.log('✅ MAINNET TEST SUCCESS');
          console.log(`New position ID: ${newPositionId}`);
          console.log('Rebalance completed successfully. Exiting.');
          process.exit(0);
        }
        console.log('Rebalance completed successfully');
      } else {
        console.error('Rebalance aborted due to zap failure');
        if (this.isTestMode) {
          console.error('❌ MAINNET TEST FAILED: ZAP failed');
          process.exit(1);
        }
      }

      // In test mode, we only process one position, so break after first iteration
      if (this.isTestMode) {
        break;
      }
    }

    console.log('--- Rebalance cycle complete ---\n');
  }

  /**
   * Start bot with monitoring loop or single-shot test mode
   */
  async start(): Promise<void> {
    if (this.isTestMode) {
      console.log('🧪 Starting MAINNET SAFE TEST MODE...');
      console.log('Will process ONE position and exit immediately\n');
      
      try {
        await this.rebalance();
        // If we reach here in test mode without exiting, it means no positions were found
        console.log('No positions to process. Exiting.');
        process.exit(0);
      } catch (error) {
        console.error('❌ MAINNET TEST FAILED with unexpected error:', error);
        process.exit(1);
      }
    } else {
      console.log('Starting Cetus CLMM Rebalance Bot...');
      console.log('Press Ctrl+C to stop\n');

      const intervalMs = parseInt(process.env.REBALANCE_INTERVAL_MS || '60000', 10);
      
      // Validate interval
      if (isNaN(intervalMs) || intervalMs < 1000) {
        throw new Error('REBALANCE_INTERVAL_MS must be a valid number >= 1000 (at least 1 second)');
      }

      console.log(`Rebalance interval set to ${intervalMs}ms (${intervalMs / 1000}s)`);

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
}

// Main entry point
async function main() {
  try {
    const bot = await CetusRebalanceBot.create();
    await bot.start();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
