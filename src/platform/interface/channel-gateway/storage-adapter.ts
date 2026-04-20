/**
 * @fileoverview Gateway Storage Adapter - Implements GatewayStoragePort using AuthoritativeTaskStore.
 *
 * This adapter bridges the GatewayStoragePort interface to the concrete
 * AuthoritativeTaskStore implementation. This allows gateway services to depend
 * on the port interface rather than the concrete store, following hexagonal
 * architecture principles.
 */

import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { GatewayStoragePort } from "./storage-port.js";
import type { GatewayTargetRecord } from "../../contracts/types/domain.js";
import type { GatewaySessionTargetCandidate } from "../../state-evidence/truth/sqlite/authoritative-task-store-types.js";

/**
 * Adapter that implements GatewayStoragePort using AuthoritativeTaskStore.
 * This allows gateway services to depend on the port interface rather than
 * the concrete store implementation.
 */
export class GatewayStorageAdapter implements GatewayStoragePort {
  constructor(private readonly store: AuthoritativeTaskStore) {}

  getGatewayTarget(targetId: string): GatewayTargetRecord | null {
    return this.store.dispatch.getGatewayTarget(targetId);
  }

  upsertGatewayTarget(target: GatewayTargetRecord): void {
    this.store.session.upsertGatewayTarget(target);
  }

  listGatewayTargets(limit = 100, channel?: string): GatewayTargetRecord[] {
    return this.store.dispatch.listGatewayTargets(limit, channel);
  }

  listGatewaySessionTargetCandidates(limit = 100, channel?: string, tenantId?: string | null): GatewaySessionTargetCandidate[] {
    return this.store.session.listGatewaySessionTargetCandidates(limit, channel, tenantId);
  }
}
