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
/**
 * Association between a pack and a domain.
 */
export interface PackDomainAssociation {
    packId: string;
    domainId: string;
    associatedAt: string;
    isPrimary: boolean;
}
/**
 * Domain with its associated packs.
 */
export interface DomainPackInfo {
    domainId: string;
    packIds: readonly string[];
    primaryPackId: string | null;
}
/**
 * Pack Domain Association Service
 *
 * Manages the relationship between Business Packs and DomainDescriptors:
 * - Associate packs with domains (many-to-one relationship)
 * - Multiple packs can share the same domain
 * - Track which pack is primary for a domain
 * - Support pack discovery by domain
 */
export declare class PackDomainAssociationService {
    private readonly packToDomain;
    private readonly domainToPacks;
    private readonly primaryPacks;
    /**
     * Associates a pack with a domain.
     * If isPrimary is true, this pack becomes the primary pack for the domain.
     */
    associatePackWithDomain(packId: string, domainId: string, isPrimary?: boolean): void;
    /**
     * Dissociates a pack from its domain.
     */
    dissociatePackFromDomain(packId: string): void;
    /**
     * Gets the domain ID for a pack.
     */
    getDomainForPack(packId: string): string | null;
    /**
     * Gets all packs associated with a domain.
     */
    listPacksInDomain(domainId: string): readonly string[];
    /**
     * Gets domain info including all associated packs.
     */
    getDomainPackInfo(domainId: string): DomainPackInfo;
    /**
     * Gets the primary pack for a domain.
     */
    getPrimaryPackForDomain(domainId: string): string | null;
    /**
     * Sets the primary pack for a domain.
     */
    setPrimaryPack(domainId: string, packId: string): void;
    /**
     * Checks if a pack is associated with any domain.
     */
    isPackAssociated(packId: string): boolean;
    /**
     * Checks if a pack is the primary pack for its domain.
     */
    isPrimaryPack(packId: string): boolean;
    /**
     * Lists all domains that have associated packs.
     */
    listAssociatedDomains(): readonly string[];
    /**
     * Gets all pack-domain associations.
     */
    getAllAssociations(): PackDomainAssociation[];
    private validationError;
}
