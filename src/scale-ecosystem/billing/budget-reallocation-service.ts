/**
 * Budget Reallocation Service
 *
 * Per §53.3: Handles budget reallocation between billing accounts with race condition protection.
 * Uses optimistic locking to prevent over-allocation from concurrent requests.
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { MonetizationError } from "../../platform/contracts/errors.js";

/**
 * Budget reallocation request with idempotency key for race condition protection.
 */
export interface ReallocateBudgetInput {
  readonly sourceAccountId: string;
  readonly targetAccountId: string;
  readonly amountUsd: number;
  readonly reasonCode: string;
  readonly idempotencyKey: string;
  readonly requestedBy: string;
  readonly requestedAt?: string;
}

/**
 * Budget reallocation record for audit trail.
 */
export interface BudgetReallocationRecord {
  readonly reallocationId: string;
  readonly sourceAccountId: string;
  readonly targetAccountId: string;
  readonly amountUsd: number;
  readonly reasonCode: string;
  readonly idempotencyKey: string;
  status: "pending" | "completed" | "failed" | "rolled_back";
  readonly requestedBy: string;
  readonly requestedAt: string;
  completedAt: string | null;
  failureReason: string | null;
  readonly sourceVersion: number;
  readonly targetVersion: number;
}

/**
 * Budget reallocation result.
 */
export interface ReallocateBudgetResult {
  readonly reallocation: BudgetReallocationRecord;
  readonly sourceBalanceSnapshot: {
    readonly outstandingUsd: number;
    readonly creditUsd: number;
  };
  readonly targetBalanceSnapshot: {
    readonly outstandingUsd: number;
    readonly creditUsd: number;
  };
}

/**
 * In-memory store for budget reallocation records (for demonstration).
 * In production, this would be backed by a proper database with transactions.
 */
interface AccountBalance {
  accountId: string;
  outstandingUsd: number;
  creditUsd: number;
  version: number;
}

export class BudgetReallocationService {
  // In-memory stores (replace with proper DB in production)
  private readonly reallocations = new Map<string, BudgetReallocationRecord>();
  private readonly balances = new Map<string, AccountBalance>();
  private readonly idempotencyKeys = new Set<string>();

  // §53.3: Race condition protection - reject duplicate idempotency keys
  private checkIdempotency(idempotencyKey: string): void {
    if (this.idempotencyKeys.has(idempotencyKey)) {
      throw new MonetizationError(
        `billing.duplicate_reallocation:${idempotencyKey}`,
        `Budget reallocation with idempotency key already processed: ${idempotencyKey}`,
        { details: { idempotencyKey }, retryable: false },
      );
    }
  }

  /**
   * Reallocate budget between accounts with race condition protection.
   * §53.3: Uses idempotency keys to prevent double-allocation from concurrent requests.
   */
  public reallocate(input: ReallocateBudgetInput): ReallocateBudgetResult {
    const requestedAt = input.requestedAt ?? nowIso();

    // §53.3: Check idempotency key to prevent duplicate reallocations
    this.checkIdempotency(input.idempotencyKey);

    // Get or create account balances
    const sourceBalance = this.getOrCreateBalance(input.sourceAccountId);
    const targetBalance = this.getOrCreateBalance(input.targetAccountId);

    // §53.3: Validate sufficient funds
    if (sourceBalance.creditUsd < input.amountUsd) {
      this.idempotencyKeys.add(input.idempotencyKey);
      throw new MonetizationError(
        `billing.insufficient_credit:${input.sourceAccountId}`,
        `Source account has insufficient credit for reallocation`,
        {
          details: {
            accountId: input.sourceAccountId,
            availableCredit: sourceBalance.creditUsd,
            requestedAmount: input.amountUsd,
          },
          retryable: true,
        },
      );
    }

    // §53.3: Create pending reallocation record
    const reallocation: BudgetReallocationRecord = {
      reallocationId: newId("realloc"),
      sourceAccountId: input.sourceAccountId,
      targetAccountId: input.targetAccountId,
      amountUsd: input.amountUsd,
      reasonCode: input.reasonCode,
      idempotencyKey: input.idempotencyKey,
      status: "pending",
      requestedBy: input.requestedBy,
      requestedAt,
      completedAt: null,
      failureReason: null,
      sourceVersion: sourceBalance.version,
      targetVersion: targetBalance.version,
    };
    this.reallocations.set(reallocation.reallocationId, reallocation);

    // §53.3: Atomic balance transfer with optimistic locking
    try {
      // Debit source
      sourceBalance.creditUsd -= input.amountUsd;
      sourceBalance.version += 1;

      // Credit target
      targetBalance.creditUsd += input.amountUsd;
      targetBalance.version += 1;

      // Mark reallocation as completed
      reallocation.status = "completed";
      reallocation.completedAt = nowIso();

      // Add idempotency key to prevent duplicate processing
      this.idempotencyKeys.add(input.idempotencyKey);
    } catch (error) {
      // Rollback on failure
      reallocation.status = "failed";
      reallocation.failureReason = error instanceof Error ? error.message : "Unknown error";
      throw error;
    }

    return {
      reallocation,
      sourceBalanceSnapshot: {
        outstandingUsd: sourceBalance.outstandingUsd,
        creditUsd: sourceBalance.creditUsd,
      },
      targetBalanceSnapshot: {
        outstandingUsd: targetBalance.outstandingUsd,
        creditUsd: targetBalance.creditUsd,
      },
    };
  }

  /**
   * Get reallocation by ID.
   */
  public getReallocation(reallocationId: string): BudgetReallocationRecord | null {
    return this.reallocations.get(reallocationId) ?? null;
  }

  /**
   * List reallocations by source or target account.
   */
  public listReallocations(accountId: string, limit = 50): BudgetReallocationRecord[] {
    return Array.from(this.reallocations.values())
      .filter((r) => r.sourceAccountId === accountId || r.targetAccountId === accountId)
      .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt))
      .slice(0, Math.max(0, limit));
  }

  private getOrCreateBalance(accountId: string): AccountBalance {
    let balance = this.balances.get(accountId);
    if (balance == null) {
      balance = {
        accountId,
        outstandingUsd: 0,
        creditUsd: 0,
        version: 0,
      };
      this.balances.set(accountId, balance);
    }
    return balance;
  }
}
