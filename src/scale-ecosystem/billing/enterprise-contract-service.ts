/**
 * Enterprise Contract Service
 *
 * Per §53.3: Manages enterprise contracts with version control and audit trail.
 * All modifications to contract terms are tracked with version history.
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { MonetizationError } from "../../platform/contracts/errors.js";

/**
 * Enterprise contract clause for individual term modifications.
 */
export interface ContractClause {
  readonly clauseId: string;
  readonly clauseType: string;
  readonly description: string;
  readonly previousText: string | null;
  readonly newText: string;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
}

/**
 * Enterprise contract version entry for audit trail.
 */
export interface ContractVersion {
  readonly versionId: string;
  readonly versionNumber: number;
  readonly contractId: string;
  readonly changedAt: string;
  readonly changedBy: string;
  readonly changeReason: string;
  readonly clauses: readonly ContractClause[];
  readonly previousVersionId: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Enterprise contract status.
 */
export type EnterpriseContractStatus = "draft" | "active" | "amending" | "renewed" | "terminated" | "expired";

/**
 * Enterprise contract record.
 */
export interface EnterpriseContract {
  readonly contractId: string;
  readonly accountId: string;
  readonly versionId: string;
  readonly versionNumber: number;
  readonly status: EnterpriseContractStatus;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly terms: Readonly<Record<string, string>>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Contract modification request.
 */
export interface ModifyContractInput {
  readonly contractId: string;
  readonly changeReason: string;
  readonly changedBy: string;
  readonly clauses: ReadonlyArray<{
    readonly clauseType: string;
    readonly description: string;
    readonly newText: string;
    readonly effectiveFrom: string;
    readonly effectiveUntil?: string | null;
  }>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Contract creation request.
 */
export interface CreateEnterpriseContractInput {
  readonly accountId: string;
  readonly terms: Readonly<Record<string, string>>;
  readonly effectiveFrom: string;
  readonly effectiveUntil?: string | null;
  readonly createdBy: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Enterprise Contract Service
 *
 * Per §53.3: Provides version control for enterprise contract modifications.
 * All changes are tracked with audit trail for compliance.
 */
export class EnterpriseContractService {
  private readonly contracts = new Map<string, EnterpriseContract>();
  private readonly versions = new Map<string, ContractVersion[]>();
  private readonly contractHistory = new Map<string, string[]>(); // contractId -> versionIds

  /**
   * Create a new enterprise contract.
   */
  public createContract(input: CreateEnterpriseContractInput): EnterpriseContract {
    const now = nowIso();
    const contractId = newId("contract");
    const versionId = newId("version");
    const versionNumber = 1;

    const contract: EnterpriseContract = {
      contractId,
      accountId: input.accountId,
      versionId,
      versionNumber,
      status: "active",
      effectiveFrom: input.effectiveFrom,
      effectiveUntil: input.effectiveUntil ?? null,
      terms: { ...input.terms },
      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy,
      metadata: input.metadata ?? {},
    };

    this.contracts.set(contractId, contract);

    // Create initial version entry
    const initialVersion: ContractVersion = {
      versionId,
      versionNumber,
      contractId,
      changedAt: now,
      changedBy: input.createdBy,
      changeReason: "Initial contract creation",
      clauses: [],
      previousVersionId: null,
      metadata: input.metadata ?? {},
    };
    this.versions.set(versionId, [initialVersion]);
    this.contractHistory.set(contractId, [versionId]);

    return contract;
  }

  /**
   * Modify an enterprise contract with version tracking.
   * §53.3: Creates a new version entry for audit trail.
   */
  public modifyContract(input: ModifyContractInput): EnterpriseContract {
    const existing = this.requireContract(input.contractId);

    if (existing.status === "terminated" || existing.status === "expired") {
      throw new MonetizationError(
        `contract.cannot_modify:${existing.status}`,
        `Contract cannot be modified: status is ${existing.status}`,
        { details: { contractId: input.contractId, status: existing.status }, retryable: false },
      );
    }

    const now = nowIso();
    const newVersionNumber = existing.versionNumber + 1;
    const newVersionId = newId("version");

    // Create clauses for the modification
    const clauses: ContractClause[] = input.clauses.map((clause) => ({
      clauseId: newId("clause"),
      clauseType: clause.clauseType,
      description: clause.description,
      previousText: existing.terms[clause.clauseType] ?? null,
      newText: clause.newText,
      effectiveFrom: clause.effectiveFrom,
      effectiveUntil: clause.effectiveUntil ?? null,
    }));

    // Update terms with new clause values
    const updatedTerms = { ...existing.terms };
    for (const clause of clauses) {
      updatedTerms[clause.clauseType] = clause.newText;
    }

    // Update contract
    const updated: EnterpriseContract = {
      ...existing,
      versionId: newVersionId,
      versionNumber: newVersionNumber,
      status: "amending",
      terms: updatedTerms,
      updatedAt: now,
    };
    this.contracts.set(input.contractId, updated);

    // Create version entry for audit trail
    const versionEntry: ContractVersion = {
      versionId: newVersionId,
      versionNumber: newVersionNumber,
      contractId: input.contractId,
      changedAt: now,
      changedBy: input.changedBy,
      changeReason: input.changeReason,
      clauses,
      previousVersionId: existing.versionId,
      metadata: input.metadata ?? {},
    };

    const existingVersions = this.versions.get(newVersionId) ?? [];
    this.versions.set(newVersionId, [...existingVersions, versionEntry]);

    const existingHistory = this.contractHistory.get(input.contractId) ?? [];
    this.contractHistory.set(input.contractId, [...existingHistory, newVersionId]);

    return updated;
  }

  /**
   * Get contract by ID.
   */
  public getContract(contractId: string): EnterpriseContract | null {
    return this.contracts.get(contractId) ?? null;
  }

  /**
   * Get contract version history.
   * §53.3: Provides audit trail for contract modifications.
   */
  public getVersionHistory(contractId: string): readonly ContractVersion[] {
    const versionIds = this.contractHistory.get(contractId) ?? [];
    const allVersions: ContractVersion[] = [];
    for (const versionId of versionIds) {
      const versions = this.versions.get(versionId) ?? [];
      allVersions.push(...versions);
    }
    return allVersions.sort((left, right) => right.versionNumber - left.versionNumber);
  }

  /**
   * Get specific version of a contract.
   */
  public getContractVersion(versionId: string): ContractVersion | null {
    const versions = this.versions.get(versionId);
    if (versions == null || versions.length === 0) {
      return null;
    }
    // Return the most recent entry for this version
    return versions[versions.length - 1];
  }

  /**
   * List all contracts for an account.
   */
  public listContracts(accountId: string): EnterpriseContract[] {
    return Array.from(this.contracts.values()).filter((c) => c.accountId === accountId);
  }

  /**
   * Terminate a contract.
   */
  public terminateContract(contractId: string, terminatedBy: string): EnterpriseContract {
    const existing = this.requireContract(contractId);
    const now = nowIso();

    const updated: EnterpriseContract = {
      ...existing,
      status: "terminated",
      updatedAt: now,
    };
    this.contracts.set(contractId, updated);

    return updated;
  }

  private requireContract(contractId: string): EnterpriseContract {
    const contract = this.contracts.get(contractId);
    if (contract == null) {
      throw new MonetizationError(
        `contract.not_found:${contractId}`,
        `Enterprise contract not found: ${contractId}`,
        { details: { contractId }, retryable: false },
      );
    }
    return contract;
  }
}
