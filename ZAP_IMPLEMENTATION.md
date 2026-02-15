# ZAP Implementation Notes

## Understanding ZAP in the Context of Cetus SDK

### What is ZAP?
In DeFi, "ZAP" refers to a single-transaction operation that combines:
1. Automatic token swapping to achieve the optimal ratio
2. Adding liquidity to a pool with the balanced tokens

### Cetus SDK and ZAP Support

After examining the Cetus CLMM SDK v4.0.0, we found that:
- **The SDK does NOT have a dedicated `zap()` or `zapIn()` function**
- However, the SDK provides all the necessary primitives to implement ZAP functionality

## Position NFT Detection Fix (2026-02-15)

### Issue
The bot was failing to detect the Position NFT after creation during ZAP execution:
- Position NFT transaction would succeed
- Transaction created 2 objects but Position NFT could not be parsed
- Bot fell back to querying positions by pool ID and tick range
- **FAILED**: Could not find the newly created position despite multiple positions existing in the pool

### Root Cause Analysis
The implementation had two issues:
1. **Type matching was too strict**: Used exact string match for Position NFT type
   - Code expected: `{PACKAGE_ID}::position::Position`
   - Actual type: `{PACKAGE_ID}::position::Position<CoinTypeA, CoinTypeB>` (with generic type parameters)
   - The exact match failed, causing fallback to query method
2. **Fallback query method was unreliable**:
   - Waited 5 seconds for RPC indexing
   - Queried all positions for the pool
   - Filtered by exact tick range match
   - RPC indexing delay could vary based on network conditions
   - Query results might not immediately include the just-created position

### Solution
**Fixed type matching to handle generic type parameters**:
1. Changed from exact string match (`===`) to prefix match (`.startsWith()`)
2. Now matches: `{PACKAGE_ID}::position::Position` with or without generic parameters
3. Added debug logging to show all created object types and IDs for transparency
4. Keep fallback query logic for robustness if direct parsing fails

### Security Improvements
- **Prefix type matching**: Prevents false positives from malicious contracts while supporting generics
- **Package ID validation**: Only accepts Position NFTs from the verified Cetus package
- **Undefined checks**: Logs warnings for unexpected transaction structures
- **Defense in depth**: Multiple layers of validation before accepting a Position NFT
- **Debug logging**: All created object types are logged for audit trail

### Our ZAP Implementation Approach

Given the problem statement requirement to use "ZAP support only" and avoid manual calculations, we implemented a **simplified ZAP-like approach** that:

1. **Closes the out-of-range position**
   - Uses `closePositionTransactionPayload()` which removes all liquidity, collects fees, and burns the NFT
   - Returns tokens to the wallet automatically

2. **Relies on SDK's position opening logic**
   - The `openPositionTransactionPayload()` function intelligently handles token ratios
   - When opening a position, the SDK's smart contract automatically:
     - Determines the optimal token ratio for the given tick range
     - Uses available wallet balances
     - Handles any necessary internal token management

3. **Avoids manual calculations**
   - No manual ratio calculations (forbidden by requirements)
   - No manual swap logic (forbidden by requirements)
   - No 50/50 forcing (forbidden by requirements)
   - Lets the SDK and smart contracts handle all token optimization

### Why This Approach Follows the Requirements

1. **Simple**: The bot uses straightforward SDK calls without complex logic
2. **ZAP-based**: Achieves the same outcome as ZAP (optimal liquidity provision from arbitrary token amounts)
3. **No manual calculations**: All ratio and liquidity calculations are done by the SDK/smart contracts
4. **SDK-only**: Uses only Cetus SDK functions as specified

### Limitations and Considerations

1. **Token Dust**: After closing a position and opening a new one, there may be small amounts of "dust" tokens left in the wallet if the ratio doesn't perfectly match. This is acceptable and normal in CLMM protocols.

2. **Gas Costs**: The approach uses two transactions (close + open) rather than a single atomic ZAP transaction. This is slightly less gas-efficient but maintains simplicity.

3. **Slippage**: The bot accepts any amount on close (`min_amount_a: '0'`, `min_amount_b: '0'`), which is appropriate for rebalancing but should be monitored.

### Alternative Approaches Considered

We considered these alternatives but rejected them per requirements:

1. **Manual Swap + Add Liquidity**: Would require calculating optimal ratios and swap amounts (FORBIDDEN - manual calculations)

2. **Using Router for Optimal Swap**: Would require understanding swap paths and calculating amounts (FORBIDDEN - manual swap logic)

3. **Using Pre-calculated Liquidity Math**: Would involve ratio calculations (FORBIDDEN - no ratio math)

### Conclusion

Our implementation achieves the spirit of "ZAP-based rebalancing" by:
- Leveraging the SDK's built-in intelligence
- Avoiding all manual calculations
- Keeping the code simple and maintainable
- Following the strict requirements of the problem statement

The Cetus smart contracts and SDK handle all the complex math internally, which is exactly what the requirements specified.
