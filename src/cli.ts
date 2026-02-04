#!/usr/bin/env node
/**
 * Agent Treasury Manager CLI
 */

import { Command } from 'commander';
import * as dotenv from 'dotenv';
import { ClawnchFeeCollector } from './collectors/clawnch';
import { TreasuryManager } from './treasury';
import { TreasuryConfig } from './types';

dotenv.config();

const program = new Command();

program
  .name('treasury')
  .description('Agent Treasury Manager - Autonomous treasury management for AI agents')
  .version('0.1.0');

// Collect fees command
program
  .command('collect')
  .description('Collect fees from Clawnch FeeLocker')
  .option('-t, --tokens <addresses...>', 'Token addresses to claim (comma-separated)')
  .action(async (options) => {
    try {
      const privateKey = process.env.BASE_PRIVATE_KEY;
      if (!privateKey) {
        console.error('❌ BASE_PRIVATE_KEY not found in environment');
        process.exit(1);
      }

      const collector = new ClawnchFeeCollector(privateKey);
      const tokenAddresses = options.tokens || [];
      
      console.log('🔍 Checking available fees...\n');
      const result = await collector.collectAllFees(tokenAddresses);
      
      console.log('\n✅ Collection complete!');
      if (result.wethClaimed) {
        console.log(`  WETH claimed: ${result.wethAmount}`);
      }
      if (result.tokensClaimed.length > 0) {
        console.log(`  Tokens claimed: ${result.tokensClaimed.length}`);
      }
    } catch (error) {
      console.error('❌ Error collecting fees:', error);
      process.exit(1);
    }
  });

// Check balances command
program
  .command('balance')
  .description('Check treasury balances across chains')
  .action(async () => {
    try {
      const config: TreasuryConfig = {
        wallets: {
          base: process.env.BASE_WALLET || '',
          solana: process.env.SOLANA_WALLET || '',
        },
        feeSources: [],
        yieldTargets: {},
        runwayAlert: {
          thresholdDays: 30,
        },
        payments: [],
      };

      if (!config.wallets.base || !config.wallets.solana) {
        console.error('❌ BASE_WALLET and SOLANA_WALLET must be set in environment');
        process.exit(1);
      }

      const treasury = new TreasuryManager(config);
      
      console.log('🔍 Fetching balances...\n');
      const balances = await treasury.getAllBalances();
      
      console.log('💰 Treasury Balances:');
      console.log(treasury.formatBalances(balances));
    } catch (error) {
      console.error('❌ Error fetching balances:', error);
      process.exit(1);
    }
  });

// Calculate runway command
program
  .command('runway')
  .description('Calculate operational runway')
  .requiredOption('-b, --burn <amount>', 'Monthly burn rate in USD')
  .action(async (options) => {
    try {
      const config: TreasuryConfig = {
        wallets: {
          base: process.env.BASE_WALLET || '',
          solana: process.env.SOLANA_WALLET || '',
        },
        feeSources: [],
        yieldTargets: {},
        runwayAlert: {
          thresholdDays: parseInt(process.env.RUNWAY_ALERT_DAYS || '30'),
        },
        payments: [],
      };

      if (!config.wallets.base || !config.wallets.solana) {
        console.error('❌ BASE_WALLET and SOLANA_WALLET must be set in environment');
        process.exit(1);
      }

      const treasury = new TreasuryManager(config);
      const burnRate = parseFloat(options.burn);
      
      console.log('🔍 Calculating runway...\n');
      const status = await treasury.getStatus(burnRate);
      
      console.log('📊 Treasury Status:');
      console.log(treasury.formatBalances(status.balances));
      console.log('\n📈 Runway Metrics:');
      console.log(treasury.formatRunway(status.runway));
      
      if (status.alerts.length > 0) {
        console.log('\n🚨 Alerts:');
        status.alerts.forEach(alert => console.log(alert));
      }
    } catch (error) {
      console.error('❌ Error calculating runway:', error);
      process.exit(1);
    }
  });

// Status command (comprehensive overview)
program
  .command('status')
  .description('Get comprehensive treasury status')
  .option('-b, --burn <amount>', 'Monthly burn rate in USD (optional)')
  .action(async (options) => {
    try {
      const config: TreasuryConfig = {
        wallets: {
          base: process.env.BASE_WALLET || '',
          solana: process.env.SOLANA_WALLET || '',
        },
        feeSources: [],
        yieldTargets: {},
        runwayAlert: {
          thresholdDays: parseInt(process.env.RUNWAY_ALERT_DAYS || '30'),
        },
        payments: [],
      };

      if (!config.wallets.base || !config.wallets.solana) {
        console.error('❌ BASE_WALLET and SOLANA_WALLET must be set in environment');
        process.exit(1);
      }

      const treasury = new TreasuryManager(config);
      const burnRate = options.burn ? parseFloat(options.burn) : 0;
      
      console.log('🤖 Agent Treasury Manager\n');
      console.log('═'.repeat(50));
      
      const status = await treasury.getStatus(burnRate);
      
      console.log('\n💰 Balances:');
      console.log(treasury.formatBalances(status.balances));
      
      if (burnRate > 0) {
        console.log('\n📈 Runway:');
        console.log(treasury.formatRunway(status.runway));
      }
      
      if (status.alerts.length > 0) {
        console.log('\n🚨 Alerts:');
        status.alerts.forEach(alert => console.log(alert));
      }
      
      console.log('\n═'.repeat(50));
      console.log('Built by Skippy for Colosseum Agent Hackathon 2026');
    } catch (error) {
      console.error('❌ Error getting status:', error);
      process.exit(1);
    }
  });

program.parse();
