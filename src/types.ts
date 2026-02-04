/**
 * Core types for Agent Treasury Manager
 */

export interface TreasuryBalance {
  chain: 'base' | 'solana' | 'ethereum';
  token: string; // Token symbol or address
  amount: bigint;
  usdValue: number;
  lastUpdated: Date;
}

export interface FeeSource {
  protocol: string; // 'clawnch', 'morpho', 'custom'
  chain: 'base' | 'solana';
  contract: string;
  tokenAddress: string;
  amountAvailable: bigint;
}

export interface RunwayMetrics {
  totalBalanceUSD: number;
  monthlyBurnRateUSD: number;
  daysRemaining: number;
  alertThreshold: number; // Days before alert
  lastCalculated: Date;
}

export interface PaymentConfig {
  provider: string; // 'openrouter', 'anthropic', etc.
  frequency: 'daily' | 'weekly' | 'monthly';
  amountUSD: number;
  autoPayEnabled: boolean;
}

export interface TreasuryConfig {
  wallets: {
    base: string;
    solana: string;
  };
  feeSources: FeeSource[];
  yieldTargets: {
    morpho?: { marketId: string; targetAPY: number };
    kamino?: { vaultAddress: string; targetAPY: number };
  };
  runwayAlert: {
    thresholdDays: number;
    notifyEmail?: string;
    notifyWebhook?: string;
  };
  payments: PaymentConfig[];
}
