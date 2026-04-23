/**
 * @fileoverview Pack Domain Association - Links packs to domains
 *
 * Implements pack-domain association as defined in architecture doc §30:
 * - Associates packs with DomainDescriptors
 * - Multiple packs can share the same DomainDescriptor
 * - Pack guides domain prompt strategy
 *
 * @see docs_zh/architecture/00-platform-architecture.md §30
 */
import { ValidationError } from "../../platform/contracts/errors.js";
// ============================================================================
// Domain Association Service
// ============================================================================
/**
 * Pack Domain Association Service
 *
 * Manages the relationship between Business Packs and DomainDescriptors:
 * - Associate packs with domains (many-to-one relationship)
 * - Multiple packs can share the same domain
 * - Track which pack is primary for a domain
 * - Support pack discovery by domain
 */
export class PackDomainAssociationService {
    packToDomain = new Map();
    domainToPacks = new Map();
    primaryPacks = new Map();
    /**
     * Associates a pack with a domain.
     * If isPrimary is true, this pack becomes the primary pack for the domain.
     */
    associatePackWithDomain(packId, domainId, isPrimary = false) {
        // Remove existing association if pack was linked to different domain
        const existingDomain = this.packToDomain.get(packId);
        if (existingDomain && existingDomain !== domainId) {
            this.dissociatePackFromDomain(packId);
        }
        this.packToDomain.set(packId, domainId);
        const packs = this.domainToPacks.get(domainId) ?? new Set();
        packs.add(packId);
        this.domainToPacks.set(domainId, packs);
        if (isPrimary) {
            this.primaryPacks.set(domainId, packId);
        }
        else if (!this.primaryPacks.has(domainId)) {
            // First pack associated becomes primary by default
            this.primaryPacks.set(domainId, packId);
        }
    }
    /**
     * Dissociates a pack from its domain.
     */
    dissociatePackFromDomain(packId) {
        const domainId = this.packToDomain.get(packId);
        if (!domainId) {
            return;
        }
        this.packToDomain.delete(packId);
        const packs = this.domainToPacks.get(domainId);
        if (packs) {
            packs.delete(packId);
            if (packs.size === 0) {
                this.domainToPacks.delete(domainId);
            }
        }
        // Clear primary if this was the primary pack
        if (this.primaryPacks.get(domainId) === packId) {
            this.primaryPacks.delete(domainId);
            // Assign new primary if any packs remain
            const remaining = this.domainToPacks.get(domainId);
            if (remaining && remaining.size > 0) {
                const firstPack = [...remaining][0];
                if (firstPack !== undefined) {
                    this.primaryPacks.set(domainId, firstPack);
                }
            }
        }
    }
    /**
     * Gets the domain ID for a pack.
     */
    getDomainForPack(packId) {
        return this.packToDomain.get(packId) ?? null;
    }
    /**
     * Gets all packs associated with a domain.
     */
    listPacksInDomain(domainId) {
        const packs = this.domainToPacks.get(domainId);
        return packs ? [...packs] : [];
    }
    /**
     * Gets domain info including all associated packs.
     */
    getDomainPackInfo(domainId) {
        const packIds = this.listPacksInDomain(domainId);
        return {
            domainId,
            packIds,
            primaryPackId: this.primaryPacks.get(domainId) ?? null,
        };
    }
    /**
     * Gets the primary pack for a domain.
     */
    getPrimaryPackForDomain(domainId) {
        return this.primaryPacks.get(domainId) ?? null;
    }
    /**
     * Sets the primary pack for a domain.
     */
    setPrimaryPack(domainId, packId) {
        const packs = this.domainToPacks.get(domainId);
        if (!packs || !packs.has(packId)) {
            throw this.validationError("pack_domain.pack_not_in_domain", `Pack ${packId} is not associated with domain ${domainId}.`);
        }
        this.primaryPacks.set(domainId, packId);
    }
    /**
     * Checks if a pack is associated with any domain.
     */
    isPackAssociated(packId) {
        return this.packToDomain.has(packId);
    }
    /**
     * Checks if a pack is the primary pack for its domain.
     */
    isPrimaryPack(packId) {
        const domainId = this.packToDomain.get(packId);
        if (!domainId) {
            return false;
        }
        return this.primaryPacks.get(domainId) === packId;
    }
    /**
     * Lists all domains that have associated packs.
     */
    listAssociatedDomains() {
        return [...this.domainToPacks.keys()];
    }
    /**
     * Gets all pack-domain associations.
     */
    getAllAssociations() {
        const associations = [];
        const now = new Date().toISOString();
        for (const [packId, domainId] of this.packToDomain) {
            associations.push({
                packId,
                domainId,
                associatedAt: now,
                isPrimary: this.isPrimaryPack(packId),
            });
        }
        return associations;
    }
    validationError(code, message) {
        return new ValidationError(code, message, {
            category: "validation",
            source: "internal",
        });
    }
}
//# sourceMappingURL=pack-domain-association.js.map