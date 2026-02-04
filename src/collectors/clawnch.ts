/**
 * Clawnch Fee Collector
 * Collects trading fees from Clanker FeeLocker contract on Base
 */

import { createPublicClient, createWalletClient, http, formatEther, parseEther } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { FeeSource } from '../types';

// Clanker FeeLocker contract on Base
const FEE_LOCKER_ADDRESS = '0xF3622742b1E446D92e45E22923Ef11C2fcD55D68' as const;
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006' as const;

const FEE_LOCKER_ABI = [
  {
    inputs: [
      { name: 'feeOwner', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    name: 'feesToClaim',
    outputs: [{ name: 'balance', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'feeOwner', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    name: 'claim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export class ClawnchFeeCollector {
  private publicClient;
  private walletClient;
  private account;

  constructor(privateKey: string, rpcUrl: string = 'https://mainnet.base.org') {
    this.account = privateKeyToAccount(privateKey as `0x${string}`);
    
    this.publicClient = createPublicClient({
      chain: base,
      transport: http(rpcUrl),
    });

    this.walletClient = createWalletClient({
      account: this.account,
      chain: base,
      transport: http(rpcUrl),
    });
  }

  /**
   * Check WETH fees available to claim
   */
  async checkWETHFees(tokenAddress?: string): Promise<FeeSource> {
    const wethFees = await this.publicClient.readContract({
      address: FEE_LOCKER_ADDRESS,
      abi: FEE_LOCKER_ABI,
      functionName: 'feesToClaim',
      args: [this.account.address, WETH_ADDRESS],
    });

    return {
      protocol: 'clawnch',
      chain: 'base',
      contract: FEE_LOCKER_ADDRESS,
      tokenAddress: WETH_ADDRESS,
      amountAvailable: wethFees,
    };
  }

  /**
   * Check token fees available to claim
   */
  async checkTokenFees(tokenAddress: string): Promise<FeeSource> {
    const tokenFees = await this.publicClient.readContract({
      address: FEE_LOCKER_ADDRESS,
      abi: FEE_LOCKER_ABI,
      functionName: 'feesToClaim',
      args: [this.account.address, tokenAddress as `0x${string}`],
    });

    return {
      protocol: 'clawnch',
      chain: 'base',
      contract: FEE_LOCKER_ADDRESS,
      tokenAddress,
      amountAvailable: tokenFees,
    };
  }

  /**
   * Claim WETH fees
   */
  async claimWETHFees(): Promise<string> {
    console.log('Claiming WETH fees from Clawnch FeeLocker...');
    
    const hash = await this.walletClient.writeContract({
      address: FEE_LOCKER_ADDRESS,
      abi: FEE_LOCKER_ABI,
      functionName: 'claim',
      args: [this.account.address, WETH_ADDRESS],
    });

    console.log(`WETH claim tx: https://basescan.org/tx/${hash}`);
    await this.publicClient.waitForTransactionReceipt({ hash });
    console.log('WETH fees claimed!');
    
    return hash;
  }

  /**
   * Claim token fees
   */
  async claimTokenFees(tokenAddress: string): Promise<string> {
    console.log(`Claiming token fees from Clawnch FeeLocker for ${tokenAddress}...`);
    
    const hash = await this.walletClient.writeContract({
      address: FEE_LOCKER_ADDRESS,
      abi: FEE_LOCKER_ABI,
      functionName: 'claim',
      args: [this.account.address, tokenAddress as `0x${string}`],
    });

    console.log(`Token claim tx: https://basescan.org/tx/${hash}`);
    await this.publicClient.waitForTransactionReceipt({ hash });
    console.log('Token fees claimed!');
    
    return hash;
  }

  /**
   * Check and claim all available fees
   */
  async collectAllFees(tokenAddresses: string[] = []): Promise<{
    wethClaimed: boolean;
    wethAmount: string;
    tokensClaimed: string[];
  }> {
    const result = {
      wethClaimed: false,
      wethAmount: '0',
      tokensClaimed: [] as string[],
    };

    // Check and claim WETH fees
    const wethFees = await this.checkWETHFees();
    if (wethFees.amountAvailable > 0n) {
      console.log(`WETH fees available: ${formatEther(wethFees.amountAvailable)} WETH`);
      await this.claimWETHFees();
      result.wethClaimed = true;
      result.wethAmount = formatEther(wethFees.amountAvailable);
    } else {
      console.log('No WETH fees to claim');
    }

    // Check and claim token fees
    for (const tokenAddress of tokenAddresses) {
      const tokenFees = await this.checkTokenFees(tokenAddress);
      if (tokenFees.amountAvailable > 0n) {
        console.log(`Token fees available: ${formatEther(tokenFees.amountAvailable)} (${tokenAddress})`);
        await this.claimTokenFees(tokenAddress);
        result.tokensClaimed.push(tokenAddress);
      }
    }

    return result;
  }
}
