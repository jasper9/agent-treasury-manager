/**
 * SOLPRISM Integration for Agent Treasury Manager
 *
 * Wraps treasury operations with commit-reveal reasoning so every
 * rebalance, transfer, and allocation decision is cryptographically
 * committed onchain BEFORE execution and revealed afterward for a
 * full, tamper-proof audit trail.
 *
 * Flow:
 *   1. Agent decides on a treasury action (rebalance, transfer, etc.)
 *   2. SOLPRISM commits a hash of the reasoning (why, risk, expected outcome)
 *   3. The treasury action executes
 *   4. SOLPRISM reveals the full reasoning onchain
 *   5. Anyone can verify the reasoning wasn't fabricated after the fact
 *
 * @see https://www.solprism.app/
 * @see Program ID: CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  SolprismClient,
  CommitResult,
  RevealResult,
  ReasoningTrace,
  createReasoningTrace,
} from '@solprism/sdk';

// ─── Types ────────────────────────────────────────────────────────────────

/** Treasury action types that SOLPRISM can wrap */
export type TreasuryActionType =
  | 'rebalance'
  | 'transfer'
  | 'allocation'
  | 'fee_collection'
  | 'yield_deployment'
  | 'payment'
  | 'swap'
  | 'emergency_withdrawal';

/** Risk level assessed by the agent before executing */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** The reasoning an agent commits before a treasury action */
export interface TreasuryReasoning {
  /** What action is being taken */
  action: TreasuryActionType;
  /** Why the agent is taking this action */
  rationale: string;
  /** Risk assessment */
  risk: {
    level: RiskLevel;
    factors: string[];
  };
  /** What the agent expects to happen */
  expectedOutcome: string;
  /** Current portfolio state (for context) */
  portfolioContext?: {
    totalValueUSD: number;
    positions: Record<string, number>;
  };
  /** Constraints the agent is operating under */
  constraints?: string[];
}

/** Result of a SOLPRISM-wrapped treasury operation */
export interface AuditedActionResult<T = unknown> {
  /** The reasoning that was committed */
  reasoning: TreasuryReasoning;
  /** SOLPRISM commit result (tx signature, commitment address, hash) */
  commit: CommitResult;
  /** SOLPRISM reveal result (tx signature, reasoning URI) */
  reveal: RevealResult;
  /** The result of the actual treasury action */
  actionResult: T;
  /** SOLPRISM explorer link for this commitment */
  explorerUrl: string;
  /** Timestamps */
  timestamps: {
    committed: Date;
    executed: Date;
    revealed: Date;
  };
}

/** Configuration for the SOLPRISM integration */
export interface SolprismIntegrationConfig {
  /** Solana RPC URL (defaults to devnet) */
  rpcUrl?: string;
  /** SOLPRISM program ID (defaults to deployed program) */
  programId?: string;
  /** Agent name for registration */
  agentName: string;
  /** Where to store full reasoning (e.g., IPFS gateway, Arweave, or API) */
  reasoningStorageUri?: string;
  /** Auto-register agent if not already registered */
  autoRegister?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────

const SOLPRISM_PROGRAM_ID = 'CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu';
const SOLPRISM_EXPLORER = 'https://www.solprism.app';
const DEFAULT_RPC = 'https://api.devnet.solana.com';

/** Map risk levels to confidence scores (0-100) */
const RISK_TO_CONFIDENCE: Record<RiskLevel, number> = {
  low: 90,
  medium: 70,
  high: 45,
  critical: 20,
};

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Convert TreasuryReasoning into a SOLPRISM ReasoningTrace.
 */
function toReasoningTrace(reasoning: TreasuryReasoning): ReasoningTrace {
  return createReasoningTrace({
    action: {
      type: reasoning.action,
      description: reasoning.rationale,
      parameters: {
        risk_level: reasoning.risk.level,
        risk_factors: reasoning.risk.factors,
        ...(reasoning.portfolioContext && {
          portfolio_value_usd: reasoning.portfolioContext.totalValueUSD,
          positions: reasoning.portfolioContext.positions,
        }),
        ...(reasoning.constraints && { constraints: reasoning.constraints }),
      },
    },
    decision: {
      confidence: RISK_TO_CONFIDENCE[reasoning.risk.level],
      reasoning: reasoning.rationale,
      expectedOutcome: reasoning.expectedOutcome,
    },
  });
}

/**
 * Build a SOLPRISM explorer URL for a commitment address.
 */
function buildExplorerUrl(commitmentAddress: string): string {
  return `${SOLPRISM_EXPLORER}/commitment/${commitmentAddress}`;
}

// ─── Main Integration Class ──────────────────────────────────────────────

/**
 * SOLPRISM-Audited Treasury Operations
 *
 * Wraps any treasury action in a commit-reveal cycle so stakeholders
 * can verify that the agent's reasoning was locked in BEFORE execution.
 *
 * @example
 * ```typescript
 * const solprism = new SolprismTreasury({
 *   agentName: 'Skippy Treasury Agent',
 * });
 * await solprism.initialize(walletKeypair);
 *
 * // Wrap a rebalance in auditable reasoning
 * const result = await solprism.executeAudited(
 *   {
 *     action: 'rebalance',
 *     rationale: 'SOL allocation drifted to 68%, target is 50%. Rebalancing to reduce concentration risk.',
 *     risk: { level: 'low', factors: ['Small position adjustment', 'High liquidity'] },
 *     expectedOutcome: 'Portfolio returns to 50/50 SOL/USDC split',
 *     portfolioContext: { totalValueUSD: 15000, positions: { SOL: 0.68, USDC: 0.32 } },
 *   },
 *   async () => {
 *     // Your actual rebalance logic here
 *     return await treasury.rebalance({ SOL: 0.5, USDC: 0.5 });
 *   }
 * );
 *
 * console.log(`Audited: ${result.explorerUrl}`);
 * ```
 */
export class SolprismTreasury {
  private client: SolprismClient;
  private config: SolprismIntegrationConfig;
  private wallet: Keypair | null = null;
  private registered = false;
  private actionLog: AuditedActionResult[] = [];

  constructor(config: SolprismIntegrationConfig) {
    this.config = {
      rpcUrl: DEFAULT_RPC,
      programId: SOLPRISM_PROGRAM_ID,
      autoRegister: true,
      ...config,
    };

    const connection = new Connection(this.config.rpcUrl!, 'confirmed');
    this.client = new SolprismClient(connection, this.config.programId);
  }

  // ─── Setup ───────────────────────────────────────────────────────────

  /**
   * Initialize the integration with a wallet keypair.
   * Optionally registers the agent on SOLPRISM if not already registered.
   */
  async initialize(wallet: Keypair): Promise<void> {
    this.wallet = wallet;

    if (this.config.autoRegister) {
      const isRegistered = await this.client.isAgentRegistered(wallet.publicKey);
      if (!isRegistered) {
        console.log(`🔐 Registering agent "${this.config.agentName}" on SOLPRISM...`);
        await this.client.registerAgent(wallet, this.config.agentName);
        console.log('✅ Agent registered on SOLPRISM');
      }
      this.registered = true;
    }
  }

  /**
   * Check if the integration is ready to use.
   */
  isReady(): boolean {
    return this.wallet !== null && this.registered;
  }

  // ─── Core: Audited Execution ─────────────────────────────────────────

  /**
   * Execute a treasury action with full SOLPRISM audit trail.
   *
   * This is the main entry point. It:
   * 1. Commits reasoning hash onchain (before action)
   * 2. Executes the treasury action
   * 3. Reveals the full reasoning onchain (after action)
   *
   * If the action fails, the commitment still exists onchain,
   * showing the agent intended to act — providing transparency
   * even for failed operations.
   *
   * @param reasoning - Why this action, risk assessment, expected outcome
   * @param action - The async function that performs the actual treasury operation
   * @returns AuditedActionResult with commit, reveal, and action results
   */
  async executeAudited<T>(
    reasoning: TreasuryReasoning,
    action: () => Promise<T>,
  ): Promise<AuditedActionResult<T>> {
    this.ensureReady();

    const trace = toReasoningTrace(reasoning);
    const timestamps = {
      committed: new Date(),
      executed: new Date(),
      revealed: new Date(),
    };

    // Step 1: Commit reasoning hash onchain
    console.log(`🔒 Committing reasoning for ${reasoning.action}...`);
    const commit = await this.client.commitReasoning(this.wallet!, trace);
    timestamps.committed = new Date();
    console.log(`   ✅ Committed: ${commit.commitmentHash.slice(0, 16)}...`);

    // Step 2: Execute the treasury action
    console.log(`⚡ Executing ${reasoning.action}...`);
    let actionResult: T;
    try {
      actionResult = await action();
      timestamps.executed = new Date();
      console.log(`   ✅ Action completed`);
    } catch (error) {
      timestamps.executed = new Date();
      console.error(`   ❌ Action failed — commitment remains onchain for audit`);
      throw error;
    }

    // Step 3: Reveal reasoning onchain
    const reasoningUri = this.buildReasoningUri(reasoning, commit);
    console.log(`📖 Revealing reasoning onchain...`);
    const reveal = await this.client.revealReasoning(
      this.wallet!,
      commit.commitmentAddress,
      reasoningUri,
    );
    timestamps.revealed = new Date();
    console.log(`   ✅ Revealed: ${reveal.reasoningUri}`);

    const result: AuditedActionResult<T> = {
      reasoning,
      commit,
      reveal,
      actionResult,
      explorerUrl: buildExplorerUrl(commit.commitmentAddress),
      timestamps,
    };

    this.actionLog.push(result as AuditedActionResult);
    return result;
  }

  // ─── Convenience Methods ─────────────────────────────────────────────

  /**
   * Wrap a rebalance operation with auditable reasoning.
   */
  async auditedRebalance<T>(
    rationale: string,
    riskLevel: RiskLevel,
    riskFactors: string[],
    expectedOutcome: string,
    portfolioContext: { totalValueUSD: number; positions: Record<string, number> },
    rebalanceFn: () => Promise<T>,
  ): Promise<AuditedActionResult<T>> {
    return this.executeAudited(
      {
        action: 'rebalance',
        rationale,
        risk: { level: riskLevel, factors: riskFactors },
        expectedOutcome,
        portfolioContext,
      },
      rebalanceFn,
    );
  }

  /**
   * Wrap a transfer operation with auditable reasoning.
   */
  async auditedTransfer<T>(
    rationale: string,
    riskLevel: RiskLevel,
    riskFactors: string[],
    expectedOutcome: string,
    transferFn: () => Promise<T>,
  ): Promise<AuditedActionResult<T>> {
    return this.executeAudited(
      {
        action: 'transfer',
        rationale,
        risk: { level: riskLevel, factors: riskFactors },
        expectedOutcome,
      },
      transferFn,
    );
  }

  /**
   * Wrap a yield deployment with auditable reasoning.
   */
  async auditedYieldDeployment<T>(
    rationale: string,
    riskLevel: RiskLevel,
    riskFactors: string[],
    expectedOutcome: string,
    deployFn: () => Promise<T>,
  ): Promise<AuditedActionResult<T>> {
    return this.executeAudited(
      {
        action: 'yield_deployment',
        rationale,
        risk: { level: riskLevel, factors: riskFactors },
        expectedOutcome,
      },
      deployFn,
    );
  }

  /**
   * Wrap a fee collection with auditable reasoning.
   */
  async auditedFeeCollection<T>(
    rationale: string,
    expectedOutcome: string,
    collectFn: () => Promise<T>,
  ): Promise<AuditedActionResult<T>> {
    return this.executeAudited(
      {
        action: 'fee_collection',
        rationale,
        risk: { level: 'low', factors: ['Routine fee collection'] },
        expectedOutcome,
      },
      collectFn,
    );
  }

  /**
   * Wrap a payment with auditable reasoning.
   */
  async auditedPayment<T>(
    rationale: string,
    riskLevel: RiskLevel,
    riskFactors: string[],
    expectedOutcome: string,
    paymentFn: () => Promise<T>,
  ): Promise<AuditedActionResult<T>> {
    return this.executeAudited(
      {
        action: 'payment',
        rationale,
        risk: { level: riskLevel, factors: riskFactors },
        expectedOutcome,
      },
      paymentFn,
    );
  }

  // ─── Verification & Audit ────────────────────────────────────────────

  /**
   * Verify that a past action's reasoning matches what was committed onchain.
   *
   * This allows stakeholders to independently confirm that the agent's
   * stated reasoning was genuinely committed before the action executed.
   */
  async verifyAction(
    commitmentAddress: string,
    reasoning: TreasuryReasoning,
  ): Promise<{
    valid: boolean;
    message: string;
    explorerUrl: string;
  }> {
    const trace = toReasoningTrace(reasoning);
    const result = await this.client.verifyReasoning(commitmentAddress, trace);

    return {
      valid: result.valid,
      message: result.message,
      explorerUrl: buildExplorerUrl(commitmentAddress),
    };
  }

  /**
   * Get the agent's accountability score from SOLPRISM.
   * Higher score = more commitments revealed = more trustworthy.
   */
  async getAccountabilityScore(): Promise<number | null> {
    this.ensureReady();
    return this.client.getAccountability(this.wallet!.publicKey);
  }

  /**
   * Get all past commitments for this agent from the chain.
   */
  async getAuditHistory(limit = 50) {
    this.ensureReady();
    return this.client.getAgentCommitments(this.wallet!.publicKey, limit);
  }

  /**
   * Get the local action log (actions performed in this session).
   */
  getSessionLog(): AuditedActionResult[] {
    return [...this.actionLog];
  }

  /**
   * Format a human-readable audit report for the current session.
   */
  formatAuditReport(): string {
    if (this.actionLog.length === 0) {
      return 'No audited actions in this session.';
    }

    const lines = [
      '═══════════════════════════════════════════════════',
      '  SOLPRISM Audit Report — Agent Treasury Manager',
      '═══════════════════════════════════════════════════',
      '',
      `  Agent: ${this.config.agentName}`,
      `  Actions: ${this.actionLog.length}`,
      `  Session: ${this.actionLog[0].timestamps.committed.toISOString()}`,
      '',
    ];

    for (const entry of this.actionLog) {
      lines.push(`  ┌─ ${entry.reasoning.action.toUpperCase()}`);
      lines.push(`  │  Rationale: ${entry.reasoning.rationale}`);
      lines.push(`  │  Risk: ${entry.reasoning.risk.level} (${entry.reasoning.risk.factors.join(', ')})`);
      lines.push(`  │  Expected: ${entry.reasoning.expectedOutcome}`);
      lines.push(`  │  Commitment: ${entry.commit.commitmentHash.slice(0, 16)}...`);
      lines.push(`  │  Explorer: ${entry.explorerUrl}`);
      lines.push(`  └─ Committed ${entry.timestamps.committed.toISOString()}`);
      lines.push('');
    }

    lines.push('═══════════════════════════════════════════════════');
    lines.push('  Verify any action: https://www.solprism.app/');
    lines.push('═══════════════════════════════════════════════════');

    return lines.join('\n');
  }

  // ─── Private Helpers ─────────────────────────────────────────────────

  private ensureReady(): void {
    if (!this.wallet) {
      throw new Error(
        'SolprismTreasury not initialized. Call initialize(wallet) first.',
      );
    }
  }

  /**
   * Build a URI for the full reasoning data.
   * In production this would upload to IPFS/Arweave; for now, inline.
   */
  private buildReasoningUri(
    reasoning: TreasuryReasoning,
    commit: CommitResult,
  ): string {
    if (this.config.reasoningStorageUri) {
      return `${this.config.reasoningStorageUri}/${commit.commitmentHash}`;
    }
    // Default: use SOLPRISM explorer as the canonical reference
    return `${SOLPRISM_EXPLORER}/commitment/${commit.commitmentAddress}`;
  }
}
