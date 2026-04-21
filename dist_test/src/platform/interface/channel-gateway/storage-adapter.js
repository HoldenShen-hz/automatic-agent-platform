/**
 * @fileoverview Gateway Storage Adapter - Implements GatewayStoragePort using AuthoritativeTaskStore.
 *
 * This adapter bridges the GatewayStoragePort interface to the concrete
 * AuthoritativeTaskStore implementation. This allows gateway services to depend
 * on the port interface rather than the concrete store, following hexagonal
 * architecture principles.
 */
/**
 * Adapter that implements GatewayStoragePort using AuthoritativeTaskStore.
 * This allows gateway services to depend on the port interface rather than
 * the concrete store implementation.
 */
export class GatewayStorageAdapter {
    store;
    constructor(store) {
        this.store = store;
    }
    getGatewayTarget(targetId) {
        return this.store.dispatch.getGatewayTarget(targetId);
    }
    upsertGatewayTarget(target) {
        this.store.session.upsertGatewayTarget(target);
    }
    listGatewayTargets(limit = 100, channel) {
        return this.store.dispatch.listGatewayTargets(limit, channel);
    }
    listGatewaySessionTargetCandidates(limit = 100, channel, tenantId) {
        return this.store.session.listGatewaySessionTargetCandidates(limit, channel, tenantId);
    }
}
//# sourceMappingURL=storage-adapter.js.map