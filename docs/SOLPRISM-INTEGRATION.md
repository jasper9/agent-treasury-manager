# SOLPRISM Integration — Auditable Treasury Reasoning

> Every rebalance decision provably committed before execution.  
> Full audit trail of **why** each allocation was made.  
> Stakeholders can verify reasoning wasn't fabricated after the fact.

## Overview

[SOLPRISM](https://www.solprism.app/) is an onchain commit-reveal protocol for AI agent reasoning. When integrated with Agent Treasury Manager, **every treasury operation** gets a cryptographic audit trail on Solana:

1. **Before** a rebalance/transfer/allocation → the agent commits a hash of its reasoning onchain
2. **Action executes** → the treasury operation runs normally
3. **After** execution → the full reasoning is revealed onchain for anyone to verify

This means an agent managing $100K in treasury funds can **prove** that its decision to shift 20% from SOL to USDC was based on risk analysis committed *before* the trade — not rationalized afterward.

**Program ID:** `CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu`  
**Explorer:** https://www.solprism.app/

## Why This Matters for Treasury Management

| Problem | SOLPRISM Solution |
|---------|------------------|
| Agent moves funds — was the reasoning sound? | Reasoning hash committed *before* execution |
| Stakeholder wants proof a rebalance was pre-planned | Onchain timestamp proves commitment preceded action |
| Auditor needs to review past decisions | Full reasoning revealed and verifiable on SOLPRISM explorer |
| Agent claims "market conditions forced my hand" | Verify confidence score and risk factors from the commitment |
| Multi-agent treasury — who decided what and why? | Each agent has its own SOLPRISM profile with accountability score |

## Installation

```bash
npm install @solprism/sdk@0.1.0
```

The SDK is already included as a dependency. No additional setup needed.

## Quick Start

```typescript
import { SolprismTreasury } from './integrations/solprism';
import { Keypair } from '@solana/web3.js';

// 1. Initialize
const solprism = new SolprismTreasury({
  agentName: 'Skippy Treasury Agent',
  rpcUrl: 'https://api.devnet.solana.com',
});

const wallet = Keypair.fromSecretKey(/* your agent keypair */);
await solprism.initialize(wallet);

// 2. Wrap any treasury action with auditable reasoning
const result = await solprism.executeAudited(
  {
    action: 'rebalance',
    rationale: 'SOL allocation drifted to 68%, target is 50%. Rebalancing to reduce concentration risk.',
    risk: {
      level: 'low',
      factors: ['Small position adjustment', 'High liquidity pair'],
    },
    expectedOutcome: 'Portfolio returns to 50/50 SOL/USDC split within 2% tolerance',
    portfolioContext: {
      totalValueUSD: 15000,
      positions: { SOL: 0.68, USDC: 0.32 },
    },
  },
  async () => {
    // Your actual treasury operation here
    return await performRebalance({ SOL: 0.5, USDC: 0.5 });
  },
);

// 3. Share the audit proof
console.log(`Verified on SOLPRISM: ${result.explorerUrl}`);
```

## Convenience Methods

For common treasury operations, use the typed convenience methods:

### Rebalancing

```typescript
const result = await solprism.auditedRebalance(
  'Monthly rebalance: crypto allocation exceeded 60% target by 15%',
  'medium',
  ['Moderate position size', 'Multiple swaps required', 'Slippage risk on smaller pairs'],
  'Portfolio rebalanced to target weights within 2% tolerance',
  { totalValueUSD: 50000, positions: { SOL: 0.45, ETH: 0.30, USDC: 0.25 } },
  async () => treasury.rebalance(targetWeights),
);
```

### Transfers

```typescript
const result = await solprism.auditedTransfer(
  'Moving 5000 USDC to operations wallet for API payment batch',
  'low',
  ['Known destination wallet', 'Routine transfer'],
  'Operations wallet funded for next 30 days of API costs',
  async () => treasury.transfer('USDC', 5000, operationsWallet),
);
```

### Yield Deployment

```typescript
const result = await solprism.auditedYieldDeployment(
  'Deploying idle USDC to Morpho Blue — current APY 4.2% exceeds 3% threshold',
  'medium',
  ['Smart contract risk', 'Protocol is audited', 'Amount within risk budget'],
  'Earn ~$175/month on idle USDC at current rates',
  async () => treasury.deployToMorpho(idleUSDC),
);
```

### Fee Collection

```typescript
const result = await solprism.auditedFeeCollection(
  'Collecting accumulated Clawnch trading fees — 0.15 WETH available',
  '0.15 WETH claimed to treasury wallet',
  async () => collector.collectAllFees(),
);
```

### Payments

```typescript
const result = await solprism.auditedPayment(
  'Monthly OpenRouter payment — $850 for inference costs',
  'low',
  ['Recurring payment', 'Known provider', 'Within budget'],
  'API access maintained for next billing cycle',
  async () => treasury.payInvoice(openrouterInvoice),
);
```

## Verification

Anyone can verify that an agent's reasoning was committed before execution:

```typescript
// Verify a specific action
const verification = await solprism.verifyAction(
  commitmentAddress,
  originalReasoning,
);

console.log(verification.valid);    // true if reasoning matches onchain hash
console.log(verification.message);  // Human-readable result
console.log(verification.explorerUrl); // Link to SOLPRISM explorer
```

Or visit the SOLPRISM explorer directly: `https://www.solprism.app/commitment/<address>`

## Accountability Score

SOLPRISM tracks an accountability score for each agent — the ratio of commitments that were followed through with reveals:

```typescript
const score = await solprism.getAccountabilityScore();
// Returns 0-100 percentage. Higher = more trustworthy.
```

This gives stakeholders a quick signal: an agent that commits reasoning and always reveals it is more trustworthy than one that commits but rarely follows through.

## Audit Report

Generate a formatted report of all audited actions in the current session:

```typescript
console.log(solprism.formatAuditReport());
```

Example output:

```
═══════════════════════════════════════════════════
  SOLPRISM Audit Report — Agent Treasury Manager
═══════════════════════════════════════════════════

  Agent: Skippy Treasury Agent
  Actions: 3
  Session: 2026-02-04T13:00:00.000Z

  ┌─ REBALANCE
  │  Rationale: SOL allocation drifted to 68%, target is 50%
  │  Risk: low (Small position adjustment, High liquidity)
  │  Expected: Portfolio returns to 50/50 SOL/USDC split
  │  Commitment: a3f8c9d1e2b7...
  │  Explorer: https://www.solprism.app/commitment/...
  └─ Committed 2026-02-04T13:00:00.000Z

  ┌─ PAYMENT
  │  Rationale: Monthly OpenRouter payment
  │  Risk: low (Recurring payment, Known provider)
  │  Expected: API access maintained for next billing cycle
  │  Commitment: b7e2f4a8d9c1...
  │  Explorer: https://www.solprism.app/commitment/...
  └─ Committed 2026-02-04T13:05:00.000Z

═══════════════════════════════════════════════════
  Verify any action: https://www.solprism.app/
═══════════════════════════════════════════════════
```

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `agentName` | *required* | Agent display name on SOLPRISM |
| `rpcUrl` | `https://api.devnet.solana.com` | Solana RPC endpoint |
| `programId` | `CZcvory...` | SOLPRISM program ID (rarely needs changing) |
| `reasoningStorageUri` | SOLPRISM explorer | Base URI for full reasoning storage |
| `autoRegister` | `true` | Register agent on SOLPRISM if not already |

## Architecture

```
┌────────────────────────────────────────────────────────┐
│              Agent Treasury Manager                     │
│                                                         │
│  ┌──────────────┐    ┌──────────────────────────────┐  │
│  │  Treasury     │    │  SOLPRISM Integration         │  │
│  │  Manager      │◄──►│  (src/integrations/solprism)  │  │
│  │              │    │                                │  │
│  │  • rebalance │    │  1. Commit reasoning hash     │  │
│  │  • transfer  │    │  2. Execute action             │  │
│  │  • allocate  │    │  3. Reveal reasoning           │  │
│  │  • collect   │    │  4. Verify onchain             │  │
│  └──────────────┘    └──────────┬───────────────────┘  │
│                                  │                      │
└──────────────────────────────────┼──────────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │     Solana (SOLPRISM)        │
                    │                              │
                    │  Program: CZcvory...QeBu     │
                    │  • Agent profiles (PDA)      │
                    │  • Commitment hashes          │
                    │  • Revealed reasoning URIs    │
                    │  • Accountability scores      │
                    │                              │
                    │  Explorer: solprism.app       │
                    └──────────────────────────────┘
```

## Environment Variables

Add to your `.env`:

```bash
# SOLPRISM Configuration (optional — defaults work for devnet)
SOLPRISM_RPC_URL=https://api.devnet.solana.com
SOLPRISM_AGENT_NAME=MyTreasuryAgent
# SOLPRISM_PROGRAM_ID=CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu
```

## FAQ

**Q: Does this slow down treasury operations?**  
A: Each commit and reveal adds ~2 Solana transactions (sub-second on devnet/mainnet). The overhead is negligible for operations like rebalancing which are already multi-second.

**Q: What if the action fails after commitment?**  
A: The commitment remains onchain, showing the agent *intended* to act. This is actually valuable — it proves the agent had a plan, even if execution failed.

**Q: Can reasoning be faked?**  
A: No. The hash is committed before the action executes. After the action, the revealed reasoning must hash to the same value. Any mismatch is immediately detectable.

**Q: What about gas costs?**  
A: SOLPRISM runs on Solana — transactions cost <$0.001. For a treasury managing thousands of dollars, this is negligible.

**Q: Is mainnet supported?**  
A: The program is deployed on devnet. Mainnet deployment is planned. Update `rpcUrl` and ensure the program is deployed on your target cluster.
