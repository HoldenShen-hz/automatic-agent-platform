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
import type { NormalizedBusinessPackManifest } from "./business-pack-manifest.js";
import {
  assertPackCompatibleWithDomain,
  type DomainPackCompatibilityDomain,
} from "./pack-domain-compatibility.js";

// ============================================================================
// Association Types
// ============================================================================

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

export interface PackDomainAssociationServiceOptions {
  readonly domainResolver?: ((domainId: string) => DomainPackCompatibilityDomain | null) | null;
  readonly packResolver?: ((packId: string) => NormalizedBusinessPackManifest | null) | null;
}

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
  private readonly packToDomain = new Map<string, string>();
  private readonly domainToPacks = new Map<string, Set<string>>();
  private readonly primaryPacks = new Map<string, string>();
  private readonly domainResolver: ((domainId: string) => DomainPackCompatibilityDomain | null) | null;
  private readonly packResolver: ((packId: string) => NormalizedBusinessPackManifest | null) | null;

  public constructor(options: PackDomainAssociationServiceOptions = {}) {
    this.domainResolver = options.domainResolver ?? null;
    this.packResolver = options.packResolver ?? null;
  }

  /**
   * Associates a pack with a domain.
   * If isPrimary is true, this pack becomes the primary pack for the domain.
   */
  public associatePackWithDomain(packId: string, domainId: string, isPrimary = false): void {
    this.assertAssociationCompatibility(packId, domainId);

    // Remove existing association if pack was linked to different domain
    const existingDomain = this.packToDomain.get(packId);
    if (existingDomain && existingDomain !== domainId) {
      this.dissociatePackFromDomain(packId);
    }

    this.packToDomain.set(packId, domainId);

    const packs = this.domainToPacks.get(domainId) ?? new Set<string>();
    packs.add(packId);
    this.domainToPacks.set(domainId, packs);

    if (isPrimary) {
      this.primaryPacks.set(domainId, packId);
    } else if (!this.primaryPacks.has(domainId)) {
      // First pack associated becomes primary by default
      this.primaryPacks.set(domainId, packId);
    }
  }

  /**
   * Dissociates a pack from its domain.
   */
  public dissociatePackFromDomain(packId: string): void {
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
  public getDomainForPack(packId: string): string | null {
    return this.packToDomain.get(packId) ?? null;
  }

  /**
   * Gets all packs associated with a domain.
   */
  public listPacksInDomain(domainId: string): readonly string[] {
    const packs = this.domainToPacks.get(domainId);
    return packs ? [...packs] : [];
  }

  /**
   * Gets domain info including all associated packs.
   */
  public getDomainPackInfo(domainId: string): DomainPackInfo {
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
  public getPrimaryPackForDomain(domainId: string): string | null {
    return this.primaryPacks.get(domainId) ?? null;
  }

  /**
   * Sets the primary pack for a domain.
   */
  public setPrimaryPack(domainId: string, packId: string): void {
    const packs = this.domainToPacks.get(domainId);
    if (!packs || !packs.has(packId)) {
      throw this.validationError(
        "pack_domain.pack_not_in_domain",
        `Pack ${packId} is not associated with domain ${domainId}.`,
      );
    }
    this.primaryPacks.set(domainId, packId);
  }

  /**
   * Checks if a pack is associated with any domain.
   */
  public isPackAssociated(packId: string): boolean {
    return this.packToDomain.has(packId);
  }

  /**
   * Checks if a pack is the primary pack for its domain.
   */
  public isPrimaryPack(packId: string): boolean {
    const domainId = this.packToDomain.get(packId);
    if (!domainId) {
      return false;
    }
    return this.primaryPacks.get(domainId) === packId;
  }

  /**
   * Lists all domains that have associated packs.
   */
  public listAssociatedDomains(): readonly string[] {
    return [...this.domainToPacks.keys()];
  }

  /**
   * Gets all pack-domain associations.
   */
  public getAllAssociations(): PackDomainAssociation[] {
    const associations: PackDomainAssociation[] = [];
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

  private validationError(code: string, message: string): ValidationError {
    return new ValidationError(code, message, {
      category: "validation",
      source: "internal",
    });
  }

  private assertAssociationCompatibility(packId: string, domainId: string): void {
    const domain = this.domainResolver?.(domainId) ?? null;
    if (this.domainResolver != null && domain == null) {
      throw this.validationError(
        "pack_domain.domain_not_found",
        `pack_domain.domain_not_found: Domain ${domainId} is not registered.`,
      );
    }
    const pack = this.packResolver?.(packId) ?? null;
    if (this.packResolver != null && pack == null) {
      throw this.validationError(
        "pack_domain.pack_not_found",
        `pack_domain.pack_not_found: Pack ${packId} is not registered.`,
      );
    }
    if (pack != null && pack.domainId !== domainId) {
      throw this.validationError(
        "pack_domain.domain_mismatch",
        `pack_domain.domain_mismatch: Pack ${packId} declares domain ${pack.domainId}, not ${domainId}.`,
      );
    }
    if (pack != null && domain != null) {
      assertPackCompatibleWithDomain(pack, domain);
    }
  }
}
