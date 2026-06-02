import { newId, nowIso } from "../../contracts/types/ids.js";
import type { SideEffectLedgerEntry } from "../side-effect-ledger/index.js";
import type { OutboxRecord } from "../../shared/outbox/index.js";

export type ArchitecturePlane = "interface" | "control" | "orchestration" | "execution" | "state_evidence" | "release";
export type HarnessCapabilityDomain =
  | "tool_gateway"
  | "memory_governance"
  | "policy_gate"
  | "release_gate"
  | "evaluation"
  | "observability"
  | "receipt";

export type BaseReceiptStatus =
  | "success"
  | "failed"
  | "blocked"
  | "requires_approval"
  | "prepared"
  | "committed";

export interface BaseReceiptMinimal {
  receiptId: string;
  schemaVersion: string;
  tenantId: string;
  missionId: string;
  sessionId?: string;
  taskId?: string;
  traceId: string;
  actorId: string;
  actionType: string;
  status: BaseReceiptStatus;
  timestamp: string;
  inputHash?: string;
  outputHash?: string;
  evidenceIds: string[];
}

export interface BaseReceiptFull extends BaseReceiptMinimal {
  parentReceiptId?: string;
  causalityId: string;
  eventSequence: number;
  canonicalizationVersion: string;
  hashAlgorithm: "sha256";
  integrityHash: string;
  integritySignature: string;
  capability: HarnessCapabilityDomain;
  plane: ArchitecturePlane;
  policyBundleVersion?: string;
  approvalPolicyId?: string;
  approvalId?: string;
  leaseId?: string;
  fencingToken?: string;
  idempotencyKey?: string;
  redactedPayloadRef?: string;
  payloadEncryptionKeyRef?: string;
  accessPolicyId: string;
  retentionPolicyId: string;
  replaySafety: "safe_to_replay" | "replay_with_mock_only" | "not_replayable";
}

export interface ReceiptShadowContext {
  tenantId: string;
  missionId: string;
  traceId: string;
  actorId: string;
  sessionId?: string;
  taskId?: string;
  schemaVersion?: string;
  actionType?: string;
  evidenceIds?: readonly string[];
  timestamp?: string;
  inputHash?: string;
  outputHash?: string;
}

export interface ReceiptShadowWriteInput {
  context: ReceiptShadowContext;
  ledgerEntry?: SideEffectLedgerEntry | null;
  outboxRecord?: OutboxRecord | null;
}

const DEFAULT_SCHEMA_VERSION = "receipt.minimal.v1";

const LEDGER_STATUS_TO_RECEIPT_STATUS: Record<SideEffectLedgerEntry["status"], BaseReceiptStatus> = {
  proposed: "prepared",
  committed: "committed",
  confirmed: "success",
  compensating: "blocked",
  compensated: "success",
  failed: "failed",
};

export function createBaseReceiptMinimal(
  input: ReceiptShadowContext & {
    receiptId?: string;
    status: BaseReceiptStatus;
  },
): BaseReceiptMinimal {
  return {
    receiptId: input.receiptId ?? newId("receipt"),
    schemaVersion: input.schemaVersion ?? DEFAULT_SCHEMA_VERSION,
    tenantId: input.tenantId,
    missionId: input.missionId,
    traceId: input.traceId,
    actorId: input.actorId,
    actionType: input.actionType ?? "unknown",
    status: input.status,
    timestamp: input.timestamp ?? nowIso(),
    evidenceIds: [...(input.evidenceIds ?? [])],
    ...(input.sessionId != null ? { sessionId: input.sessionId } : {}),
    ...(input.taskId != null ? { taskId: input.taskId } : {}),
    ...(input.inputHash != null ? { inputHash: input.inputHash } : {}),
    ...(input.outputHash != null ? { outputHash: input.outputHash } : {}),
  };
}

export function createReceiptFromSideEffectLedgerEntry(
  entry: SideEffectLedgerEntry,
  context: ReceiptShadowContext,
): BaseReceiptMinimal {
  return createBaseReceiptMinimal({
    ...context,
    receiptId: entry.sideEffectId,
    actionType: context.actionType ?? `side_effect:${entry.idempotencyKey}`,
    status: LEDGER_STATUS_TO_RECEIPT_STATUS[entry.status],
    evidenceIds: mergeEvidenceIds(context.evidenceIds, entry.evidenceRefs),
  });
}

export function createReceiptFromOutboxRecord(
  record: OutboxRecord,
  context: ReceiptShadowContext,
): BaseReceiptMinimal {
  return createBaseReceiptMinimal({
    ...context,
    receiptId: record.id,
    actionType: context.actionType ?? `outbox:${record.eventType}`,
    status: resolveOutboxReceiptStatus(record),
    timestamp: context.timestamp ?? record.createdAt,
    evidenceIds: [...(context.evidenceIds ?? [])],
  });
}

export function buildReceiptShadowWrites(input: ReceiptShadowWriteInput): BaseReceiptMinimal[] {
  const receipts: BaseReceiptMinimal[] = [];
  if (input.ledgerEntry != null) {
    receipts.push(createReceiptFromSideEffectLedgerEntry(input.ledgerEntry, input.context));
  }
  if (input.outboxRecord != null) {
    receipts.push(createReceiptFromOutboxRecord(input.outboxRecord, input.context));
  }
  return receipts;
}

function mergeEvidenceIds(
  left: readonly string[] | undefined,
  right: readonly string[],
): string[] {
  return [...new Set([...(left ?? []), ...right])];
}

function resolveOutboxReceiptStatus(record: OutboxRecord): BaseReceiptStatus {
  if (record.publishedAt != null) {
    return "committed";
  }
  if (record.lastError != null || record.retryCount > 0) {
    return "failed";
  }
  return "prepared";
}
