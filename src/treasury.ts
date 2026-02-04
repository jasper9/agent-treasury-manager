/**
 * Treasury Manager - Core treasury tracking and runway calculation
 */

import { TreasuryBalance, RunwayMetrics, TreasuryConfig } from './types';
import { createPublicClient, http, formatEther } from 'viem';
import { base } from 'viem/chains';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

export class TreasuryManager {
  private config: TreasuryConfig;
  private baseClient;
  private solanaConnection;

  constructor(config: TreasuryConfig, solanaRpcUrl: string = 'https://api.mainnet-beta.solana.com') {
    this.config = config;
    
    this.baseClient = createPublicClient({
      chain: base,
      transport: http('https://mainnet.base.org'),
    });

    this.solanaConnection = new Connection(solanaRpcUrl, 'confirmed');
  }

  /**
   * Get ETH balance on Base
   */
  async getBaseETHBalance(): Promise<TreasuryBalance> {
    const balance = await this.baseClient.getBalance({
      address: this.config.wallets.base as `0x${string}`,
    });

    return {
      chain: 'base',
      token: 'ETH',
      amount: balance,
      usdValue: 0, // TODO: Add price oracle
      lastUpdated: new Date(),
    };
  }

  /**
   * Get SOL balance on Solana
   */
  async getSolanaSOLBalance(): Promise<TreasuryBalance> {
    const pubkey = new PublicKey(this.config.wallets.solana);
    const balance = await this.solanaConnection.getBalance(pubkey);

    return {
      chain: 'solana',
      token: 'SOL',
      amount: BigInt(balance),
      usdValue: 0, // TODO: Add price oracle
      lastUpdated: new Date(),
    };
  }

  /**
   * Get all treasury balances
   */
  async getAllBalances(): Promise<TreasuryBalance[]> {
    const balances: TreasuryBalance[] = [];

    try {
      const baseETH = await this.getBaseETHBalance();
      balances.push(baseETH);
    } catch (error) {
      console.error('Error fetching Base ETH balance:', error);
    }

    try {
      const solanaSOL = await this.getSolanaSOLBalance();
      balances.push(solanaSOL);
    } catch (error) {
      console.error('Error fetching Solana SOL balance:', error);
    }

    return balances;
  }

  /**
   * Calculate runway metrics
   * 
   * @param monthlyBurnRateUSD - Estimated monthly burn rate in USD
   */
  calculateRunway(totalBalanceUSD: number, monthlyBurnRateUSD: number): RunwayMetrics {
    const daysRemaining = totalBalanceUSD > 0 && monthlyBurnRateUSD > 0
      ? (totalBalanceUSD / monthlyBurnRateUSD) * 30
      : Infinity;

    return {
      totalBalanceUSD,
      monthlyBurnRateUSD,
      daysRemaining,
      alertThreshold: this.config.runwayAlert.thresholdDays,
      lastCalculated: new Date(),
    };
  }

  /**
   * Get comprehensive treasury status
   */
  async getStatus(monthlyBurnRateUSD: number = 0): Promise<{
    balances: TreasuryBalance[];
    runway: RunwayMetrics;
    alerts: string[];
  }> {
    const balances = await this.getAllBalances();
    
    // Calculate total USD value (simplified - would need price oracle)
    const totalBalanceUSD = balances.reduce((sum, b) => sum + b.usdValue, 0);
    
    const runway = this.calculateRunway(totalBalanceUSD, monthlyBurnRateUSD);
    
    // Generate alerts
    const alerts: string[] = [];
    if (runway.daysRemaining < this.config.runwayAlert.thresholdDays) {
      alerts.push(`⚠️  LOW RUNWAY: Only ${runway.daysRemaining.toFixed(1)} days remaining!`);
    }

    return {
      balances,
      runway,
      alerts,
    };
  }

  /**
   * Format balances for display
   */
  formatBalances(balances: TreasuryBalance[]): string {
    return balances.map(b => {
      const amount = b.token === 'ETH' || b.token === 'SOL'
        ? formatEther(b.amount)
        : b.amount.toString();
      return `${b.chain.toUpperCase()} - ${amount} ${b.token}`;
    }).join('\n');
  }

  /**
   * Format runway metrics for display
   */
  formatRunway(runway: RunwayMetrics): string {
    return [
      `Total Balance: $${runway.totalBalanceUSD.toFixed(2)}`,
      `Monthly Burn: $${runway.monthlyBurnRateUSD.toFixed(2)}`,
      `Days Remaining: ${runway.daysRemaining === Infinity ? '∞' : runway.daysRemaining.toFixed(1)}`,
      `Alert Threshold: ${runway.alertThreshold} days`,
    ].join('\n');
  }
}
