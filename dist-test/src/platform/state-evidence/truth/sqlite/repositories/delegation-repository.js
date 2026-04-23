/**
 * Delegation Repository
 *
 * Data access layer for agent delegation tables.
 * Part of §26 storage layer implementation.
 */
import { newId, nowIso } from "../../../../contracts/types/ids.js";
/**
 * In-memory implementation of DelegationRepository.
 */
export class InMemoryDelegationRepository {
    delegations = new Map();
    async create(input) {
        const delegationId = newId("delegation");
        const now = nowIso();
        const delegation = {
            delegationId,
            parentAgentId: input.parentAgentId,
            childAgentId: input.childAgentId,
            delegationChain: input.delegationChain,
            status: "pending",
            depth: input.depth,
            expiresAt: input.expiresAt ?? null,
            resultRef: null,
            createdAt: now,
            updatedAt: now,
        };
        this.delegations.set(delegationId, delegation);
        return delegation;
    }
    async findById(delegationId) {
        return this.delegations.get(delegationId) ?? null;
    }
    async findByParentAgentId(parentAgentId) {
        return [...this.delegations.values()].filter((d) => d.parentAgentId === parentAgentId);
    }
    async findByStatus(status) {
        return [...this.delegations.values()].filter((d) => d.status === status);
    }
    async findExpired(now) {
        return [...this.delegations.values()].filter((d) => d.expiresAt !== null && d.expiresAt < now && (d.status === "pending" || d.status === "active"));
    }
    async updateStatus(delegationId, status) {
        const existing = this.delegations.get(delegationId);
        if (existing) {
            existing.status = status;
            existing.updatedAt = nowIso();
        }
    }
    async complete(delegationId, resultRef) {
        const existing = this.delegations.get(delegationId);
        if (existing) {
            existing.status = "completed";
            existing.resultRef = resultRef;
            existing.updatedAt = nowIso();
        }
    }
    async fail(delegationId, _error) {
        const existing = this.delegations.get(delegationId);
        if (existing) {
            existing.status = "failed";
            existing.updatedAt = nowIso();
        }
    }
    async delete(delegationId) {
        this.delegations.delete(delegationId);
    }
}
/**
 * In-memory implementation of DelegationEventRepository.
 */
export class InMemoryDelegationEventRepository {
    events = new Map();
    async create(input) {
        const eventId = newId("delegation_event");
        const now = nowIso();
        const event = {
            eventId,
            delegationId: input.delegationId,
            eventType: input.eventType,
            payload: input.payload,
            createdAt: now,
        };
        const existing = this.events.get(input.delegationId) ?? [];
        existing.push(event);
        this.events.set(input.delegationId, existing);
        return event;
    }
    async findByDelegationId(delegationId) {
        return this.events.get(delegationId) ?? [];
    }
    async deleteByDelegationId(delegationId) {
        this.events.delete(delegationId);
    }
}
//# sourceMappingURL=delegation-repository.js.map