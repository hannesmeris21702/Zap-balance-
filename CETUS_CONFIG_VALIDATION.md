# Cetus SDK Configuration Validation

## Overview

This document describes the Cetus SDK configuration validation feature that checks the package and config version before initializing the bot.

## What It Does

The bot now validates the Cetus SDK configuration on startup by:

1. **Reading Environment Variables**: Reads `CETUS_CLMM_PACKAGE_ID` and `CETUS_GLOBAL_CONFIG_ID` from the environment
2. **Fetching Global Config**: Retrieves the global configuration object from the Sui blockchain
3. **Extracting Package ID**: Extracts the package ID from the config object (either from the type field or from config fields)
4. **Comparing Package IDs**: Compares the config's package ID with the expected `CETUS_CLMM_PACKAGE_ID`
5. **Aborting on Mismatch**: If the package IDs don't match, the bot aborts with a clear error message
6. **Fetching Package Version**: Attempts to fetch the package version from the blockchain
7. **Logging Summary**: Logs all configuration details including package ID, config ID, and version

## Configuration

Add the following environment variables to your `.env` file:

```bash
# Cetus SDK Configuration
CETUS_CLMM_PACKAGE_ID=0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb
CETUS_GLOBAL_CONFIG_ID=0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f
```

These values are already set in `.env.example` with the correct mainnet values.

## Implementation Details

### Validation Function

The `validateCetusConfig()` function is called before the SDK is initialized in the bot's factory method `CetusRebalanceBot.create()`.

```typescript
async function validateCetusConfig(suiClient: SuiClient): Promise<void>
```

### Architecture Change

The bot constructor has been changed from a public constructor to a private constructor with a static factory method:

**Before:**
```typescript
const bot = new CetusRebalanceBot();
```

**After:**
```typescript
const bot = await CetusRebalanceBot.create();
```

This ensures that validation always runs before the SDK is initialized.

### Package ID Extraction

The validation function attempts to extract the package ID from the config object in two ways:

1. **From the type field**: Extracts the package ID from the Move object type (format: `package_id::module::Type`)
2. **From config fields**: Checks if there's a `package` field in the config object's fields

This dual approach ensures compatibility with different versions of the Cetus protocol.

## Example Output

### Successful Validation

```
=== Validating Cetus SDK Configuration ===
CETUS_CLMM_PACKAGE_ID: 0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb
CETUS_GLOBAL_CONFIG_ID: 0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f

Fetching global config object...
Config package ID: 0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb
✓ Package ID validation passed

Fetching package version...
Package version: 12345

=== Configuration Summary ===
Package ID: 0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb
Global Config ID: 0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f
✓ Validation completed successfully
```

### Failed Validation (Package Mismatch)

```
=== Validating Cetus SDK Configuration ===
CETUS_CLMM_PACKAGE_ID: 0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb
CETUS_GLOBAL_CONFIG_ID: 0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f

Fetching global config object...
Config package ID: 0xdifferentpackageid...

❌ ERROR: Package ID mismatch!
  Expected (CETUS_CLMM_PACKAGE_ID): 0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb
  Found in config: 0xdifferentpackageid...
  The SDK configuration does not match the on-chain global config.
  Please update your environment variables to match the correct package ID.
```

### Missing Environment Variables

```
=== Validating Cetus SDK Configuration ===
❌ ERROR: CETUS_CLMM_PACKAGE_ID and CETUS_GLOBAL_CONFIG_ID must be set in environment
```

## Error Handling

The validation function handles various error scenarios:

- **Missing environment variables**: Aborts with error message
- **Config object not found**: Aborts with error message
- **Package ID mismatch**: Aborts with detailed error message showing both expected and actual values
- **Version fetch failure**: Logs warning but continues (non-critical)
- **Network errors**: Aborts with error message

All critical errors result in `process.exit(1)` to prevent the bot from running with invalid configuration.

## Benefits

1. **Early Error Detection**: Catches configuration mismatches before the bot starts processing
2. **Clear Error Messages**: Provides detailed error messages to help users fix configuration issues
3. **Version Tracking**: Logs the package version for troubleshooting and audit purposes
4. **Safety**: Prevents the bot from running with incorrect SDK configuration that could lead to transaction failures
5. **Transparency**: Shows exactly which package and config IDs are being used

## SDK Modules Used

While the problem statement mentioned importing `PositionModule`, `ConfigModule`, and `PackageModule` from the official Cetus SDK, the actual implementation uses:

- **SuiClient** from `@mysten/sui.js/client` - For fetching on-chain objects
- The SDK modules (Position, Config, etc.) are accessed through the `CetusClmmSDK` instance after validation

This approach is consistent with how the Cetus SDK is designed to be used and provides direct access to on-chain data for validation purposes.
