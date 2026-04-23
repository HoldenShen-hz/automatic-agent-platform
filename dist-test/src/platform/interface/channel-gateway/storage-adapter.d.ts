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
export declare class GatewayStorageAdapter implements GatewayStoragePort {
    private readonly store;
    constructor(store: AuthoritativeTaskStore);
    getGatewayTarget(targetId: string): GatewayTargetRecord | null;
    upsertGatewayTarget(target: GatewayTargetRecord): void;
    listGatewayTargets(limit?: number, channel?: string): GatewayTargetRecord[];
    listGatewaySessionTargetCandidates(limit?: number, channel?: string, tenantId?: string | null): GatewaySessionTargetCandidate[];
}
