/**
 * @fileoverview Gateway Storage Adapter - Implements GatewayStoragePort using AuthoritativeTaskStore.
 *
 * This adapter bridges the GatewayStoragePort interface to the concrete
 * AuthoritativeTaskStore implementation. This allows gateway services to depend
 * on the port interface rather than the concrete store, following hexagonal
 * architecture principles.
 */

import type { GatewayStoragePort } from "./storage-port.js";
import type { GatewayTargetRecord } from "../../contracts/types/domain.js";
import type { GatewaySessionTargetCandidate } from "../../five-plane-state-evidence/truth/sqlite/authoritative-task-store-types.js";

/**
 * Adapter that implements GatewayStoragePort using AuthoritativeTaskStore.
 * This allows gateway services to depend on the port interface rather than
 * the concrete store implementation.
 */
export class GatewayStorageAdapter implements GatewayStoragePort {
  constructor(private readonly store: GatewayStoragePort | {
    dispatch: Pick<GatewayStoragePort, "getGatewayTarget" | "listGatewayTargets">;
    session: Pick<GatewayStoragePort, "upsertGatewayTarget" | "listGatewaySessionTargetCandidates">;
  }) {}

  getGatewayTarget(targetId: string): GatewayTargetRecord | null {
    if ("getGatewayTarget" in this.store) {
      return this.store.getGatewayTarget(targetId);
    }
    return this.store.dispatch.getGatewayTarget(targetId);
  }

  upsertGatewayTarget(target: GatewayTargetRecord): void {
    if ("upsertGatewayTarget" in this.store) {
      this.store.upsertGatewayTarget(target);
      return;
    }
    this.store.session.upsertGatewayTarget(target);
  }

  listGatewayTargets(limit = 100, channel?: string): GatewayTargetRecord[] {
    if ("listGatewayTargets" in this.store) {
      return this.store.listGatewayTargets(limit, channel);
    }
    return this.store.dispatch.listGatewayTargets(limit, channel);
  }

  listGatewaySessionTargetCandidates(limit = 100, channel?: string, tenantId?: string | null): GatewaySessionTargetCandidate[] {
    if ("listGatewaySessionTargetCandidates" in this.store) {
      return this.store.listGatewaySessionTargetCandidates(limit, channel, tenantId);
    }
    return this.store.session.listGatewaySessionTargetCandidates(limit, channel, tenantId);
  }
}
