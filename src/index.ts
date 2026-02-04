/**
 * Agent Treasury Manager
 * Main entry point for programmatic usage
 */

export { ClawnchFeeCollector } from './collectors/clawnch';
export { TreasuryManager } from './treasury';
export { SolprismTreasury } from './integrations/solprism';
export type {
  TreasuryActionType,
  RiskLevel,
  TreasuryReasoning,
  AuditedActionResult,
  SolprismIntegrationConfig,
} from './integrations/solprism';
export * from './types';

// Version
export const VERSION = '0.1.0';
