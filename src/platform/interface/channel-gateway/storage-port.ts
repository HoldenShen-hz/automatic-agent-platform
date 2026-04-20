/**
 * @fileoverview Gateway Storage Port - Interface for gateway storage operations.
 *
 * Abstracts the storage layer so the gateway does not depend on the concrete
 * AuthoritativeTaskStore implementation. This allows the gateway to be tested in isolation
 * and decouples it from the SQLite-specific storage implementation.
 */

import type { GatewayTargetRecord } from "../../contracts/types/domain.js";
import type { GatewaySessionTargetCandidate } from "../../state-evidence/truth/sqlite/authoritative-task-store-types.js";

/**
 * Port interface for gateway storage operations.
 * The gateway uses this interface to access target and delivery data
 * without depending on the concrete AuthoritativeTaskStore implementation.
 */
export interface GatewayStoragePort {
  /**
   * Retrieves a gateway target by its internal ID.
   * @param targetId - The target identifier
   * @returns The gateway target record, or null if not found
   */
  getGatewayTarget(targetId: string): GatewayTargetRecord | null;

  /**
   * Inserts or updates a gateway target record.
   * @param target - The gateway target to upsert
   */
  upsertGatewayTarget(target: GatewayTargetRecord): void;

  /**
   * Lists registered gateway targets with optional channel filter.
   * @param limit - Maximum number of results
   * @param channel - Optional channel filter
   * @returns Array of gateway target records
   */
  listGatewayTargets(limit?: number, channel?: string): GatewayTargetRecord[];

  /**
   * Lists gateway session target candidates from execution history.
   * @param limit - Maximum number of results
   * @param channel - Optional channel filter
   * @param tenantId - Optional tenant filter
   * @returns Array of session target candidates
   */
  listGatewaySessionTargetCandidates(limit?: number, channel?: string, tenantId?: string | null): GatewaySessionTargetCandidate[];
}
