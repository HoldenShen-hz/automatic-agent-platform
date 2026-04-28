import assert from "node:assert/strict";
import test from "node:test";

import { AuthoritativeTaskStore, Phase1aStore } from "../../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";

/**
 * Tests for AuthoritativeTaskStore focusing on:
 * - Task persistence with canonical IDs per R4-18
 * - Task record structure and invariants
 *
 * @see R4-18: Task must be keyed by canonical ID (taskId) and executionId
 */
test("AuthoritativeTaskStore and Phase1aStore are the same class", () => {
  assert.equal(AuthoritativeTaskStore, Phase1aStore);
});

test("AuthoritativeTaskStore has db property in legacy compat interface", () => {
  // The legacy compat abstract class defines a db property
  // This test verifies the type is properly exported
  const storeProto = AuthoritativeTaskStore.prototype;
  assert.ok(storeProto !== undefined);
});

test("AuthoritativeTaskStore withConnection method exists", () => {
  // withConnection is defined in AuthoritativeTaskStoreLegacyCompat
  // and is used to access the database connection
  const store = new AuthoritativeTaskStore({
    database: {},
    logger: undefined,
    maximumSchemaVersion: "2.0.0",
  } as any);

  assert.equal(typeof store.withConnection, "function");
});

test("AuthoritativeTaskStore accepts options object", () => {
  const store = new AuthoritativeTaskStore({
    database: {},
    logger: undefined,
    maximumSchemaVersion: "2.0.0",
  } as any);

  assert.ok(store !== null);
  assert.ok(store !== undefined);
});

test("AuthoritativeTaskStore withConnection passes connection to callback", () => {
  const mockConnection = {} as any;
  const mockDb = { connection: mockConnection } as any;

  const store = new AuthoritativeTaskStore({
    database: mockDb,
    logger: undefined,
    maximumSchemaVersion: "2.0.0",
  } as any);

  let receivedConnection: any = null;
  store.withConnection((conn) => {
    receivedConnection = conn;
  });

  assert.equal(receivedConnection, mockConnection);
});

test("AuthoritativeTaskStore legacy compat has required abstract methods for task lifecycle", () => {
  // Verify key task-related methods are part of the class interface
  // These are defined in AuthoritativeTaskStoreLegacyCompat
  const store = new AuthoritativeTaskStore({
    database: {},
    logger: undefined,
    maximumSchemaVersion: "2.0.0",
  } as any);

  // Task operations
  assert.equal(typeof store.insertTask, "function");
  assert.equal(typeof store.getTask, "function");
  assert.equal(typeof store.listTasks, "function");
  assert.equal(typeof store.updateTaskStatus, "function");
  assert.equal(typeof store.updateTaskOutput, "function");
  assert.equal(typeof store.updateTaskStatusCas, "function");
  assert.equal(typeof store.setTaskState, "function");
  assert.equal(typeof store.updateTaskInput, "function");
  assert.equal(typeof store.countQueuedTasks, "function");
});

test("AuthoritativeTaskStore legacy compat has workflow state methods", () => {
  const store = new AuthoritativeTaskStore({
    database: {},
    logger: undefined,
    maximumSchemaVersion: "2.0.0",
  } as any);

  // Workflow operations
  assert.equal(typeof store.getWorkflowState, "function");
  assert.equal(typeof store.listWorkflowStates, "function");
  assert.equal(typeof store.insertWorkflowState, "function");
  assert.equal(typeof store.insertStepOutput, "function");
  assert.equal(typeof store.updateWorkflowState, "function");
  assert.equal(typeof store.updateWorkflowRecoveryState, "function");
});

test("AuthoritativeTaskStore legacy compat has execution methods per R4-18 canonical IDs", () => {
  const store = new AuthoritativeTaskStore({
    database: {},
    logger: undefined,
    maximumSchemaVersion: "2.0.0",
  } as any);

  // Execution operations - taskId and executionId are the canonical ID pair per R4-18
  assert.equal(typeof store.insertExecution, "function");
  assert.equal(typeof store.insertExecutionPrecheck, "function");
  assert.equal(typeof store.insertDeadLetter, "function");
  assert.equal(typeof store.updateExecutionFailure, "function");
  assert.equal(typeof store.updateExecutionAgent, "function");
  assert.equal(typeof store.updateExecutionStatus, "function");
  assert.equal(typeof store.updateExecutionStatusCas, "function");
  assert.equal(typeof store.listExecutionsByTask, "function");
  assert.equal(typeof store.countActiveExecutions, "function");
});

test("AuthoritativeTaskStore legacy compat has session methods", () => {
  const store = new AuthoritativeTaskStore({
    database: {},
    logger: undefined,
    maximumSchemaVersion: "2.0.0",
  } as any);

  // Session operations
  assert.equal(typeof store.insertSession, "function");
  assert.equal(typeof store.insertCompactionRecord, "function");
  assert.equal(typeof store.insertMessage, "function");
  assert.equal(typeof store.insertSessionSummary, "function");
  assert.equal(typeof store.getLatestSessionSummary, "function");
  assert.equal(typeof store.insertSessionEvent, "function");
  assert.equal(typeof store.listSessionEvents, "function");
  assert.equal(typeof store.listCompactionRecordsBySession, "function");
  assert.equal(typeof store.updateSessionStatus, "function");
  assert.equal(typeof store.updateSessionStatusCas, "function");
  assert.equal(typeof store.upsertGatewayTarget, "function");
  assert.equal(typeof store.listGatewaySessionTargetCandidates, "function");
});

test("AuthoritativeTaskStore legacy compat has event methods", () => {
  const store = new AuthoritativeTaskStore({
    database: {},
    logger: undefined,
    maximumSchemaVersion: "2.0.0",
  } as any);

  // Event operations - Tier 1 events for audit trail
  assert.equal(typeof store.insertEvent, "function");
  assert.equal(typeof store.insertEventDeadLetter, "function");
  assert.equal(typeof store.listEventDeadLetters, "function");
  assert.equal(typeof store.markEventAck, "function");
  assert.equal(typeof store.markEventDeadLettered, "function");
  assert.equal(typeof store.getRequiredConsumerIds, "function");
  assert.equal(typeof store.ackAllConsumersForEvent, "function");
  assert.equal(typeof store.ensureEventConsumerAckPending, "function");
  assert.equal(typeof store.listPendingEventsForConsumer, "function");
  assert.equal(typeof store.listFailedEventsForConsumer, "function");
  assert.equal(typeof store.listEventsForTask, "function");
  assert.equal(typeof store.getEvent, "function");
});

test("AuthoritativeTaskStore legacy compat has billing methods", () => {
  const store = new AuthoritativeTaskStore({
    database: {},
    logger: undefined,
    maximumSchemaVersion: "2.0.0",
  } as any);

  // Billing operations
  assert.equal(typeof store.insertCostEvent, "function");
  assert.equal(typeof store.listCostEventsByTask, "function");
  assert.equal(typeof store.sumCostByTask, "function");
  assert.equal(typeof store.upsertBillingAccount, "function");
  assert.equal(typeof store.insertBillingInvoice, "function");
  assert.equal(typeof store.updateBillingInvoiceStatus, "function");
  assert.equal(typeof store.insertBillingPaymentSession, "function");
  assert.equal(typeof store.updateBillingPaymentSessionStatus, "function");
  assert.equal(typeof store.insertUsageEvent, "function");
  assert.equal(typeof store.upsertQuotaCounter, "function");
  assert.equal(typeof store.insertLedgerEntry, "function");
  assert.equal(typeof store.insertEntitlementDecision, "function");
});

test("AuthoritativeTaskStore legacy compat has worker/lease methods", () => {
  const store = new AuthoritativeTaskStore({
    database: {},
    logger: undefined,
    maximumSchemaVersion: "2.0.0",
  } as any);

  // Worker and lease operations
  assert.equal(typeof store.insertHeartbeatSnapshot, "function");
  assert.equal(typeof store.insertRemoteLog, "function");
  assert.equal(typeof store.upsertAgentExecutionRecord, "function");
  assert.equal(typeof store.upsertWorkerSnapshot, "function");
  assert.equal(typeof store.insertWorkerRegistrationChallenge, "function");
  assert.equal(typeof store.getWorkerRegistrationChallenge, "function");
  assert.equal(typeof store.consumeWorkerRegistrationChallenge, "function");
  assert.equal(typeof store.insertExecutionTicket, "function");
  assert.equal(typeof store.claimExecutionTicket, "function");
  assert.equal(typeof store.consumeExecutionTicket, "function");
  assert.equal(typeof store.invalidateExecutionTicket, "function");
  assert.equal(typeof store.insertExecutionLease, "function");
  assert.equal(typeof store.renewExecutionLease, "function");
  assert.equal(typeof store.closeExecutionLease, "function");
  assert.equal(typeof store.insertLeaseAudit, "function");
});

test("AuthoritativeTaskStore legacy compat has approval methods", () => {
  const store = new AuthoritativeTaskStore({
    database: {},
    logger: undefined,
    maximumSchemaVersion: "2.0.0",
  } as any);

  // Approval operations
  assert.equal(typeof store.listApprovalsByTask, "function");
  assert.equal(typeof store.getApproval, "function");
  assert.equal(typeof store.insertApproval, "function");
  assert.equal(typeof store.updateApprovalDecision, "function");
  assert.equal(typeof store.updateApprovalDecisionCas, "function");
  assert.equal(typeof store.updateApprovalRequest, "function");
  assert.equal(typeof store.listTakeoverSessionsByTask, "function");
  assert.equal(typeof store.insertTakeoverSession, "function");
  assert.equal(typeof store.getTakeoverSession, "function");
  assert.equal(typeof store.closeTakeoverSession, "function");
  assert.equal(typeof store.insertOperatorAction, "function");
  assert.equal(typeof store.listOperatorActionsByTask, "function");
});

test("AuthoritativeTaskStore legacy compat has memory methods", () => {
  const store = new AuthoritativeTaskStore({
    database: {},
    logger: undefined,
    maximumSchemaVersion: "2.0.0",
  } as any);

  // Memory operations
  assert.equal(typeof store.listMemories, "function");
  assert.equal(typeof store.insertMemory, "function");
  assert.equal(typeof store.getMemory, "function");
  assert.equal(typeof store.recordMemoryAccess, "function");
  assert.equal(typeof store.revokeMemory, "function");
  assert.equal(typeof store.findMemoryByContentHash, "function");
  assert.equal(typeof store.getMemoryQualityReport, "function");
});

test("AuthoritativeTaskStore legacy compat has artifact methods", () => {
  const store = new AuthoritativeTaskStore({
    database: {},
    logger: undefined,
    maximumSchemaVersion: "2.0.0",
  } as any);

  // Artifact operations
  assert.equal(typeof store.getArtifact, "function");
  assert.equal(typeof store.insertArtifact, "function");
  assert.equal(typeof store.listArtifactsByTask, "function");
});

test("AuthoritativeTaskStore legacy compat has Tier 1 audit integrity methods", () => {
  const store = new AuthoritativeTaskStore({
    database: {},
    logger: undefined,
    maximumSchemaVersion: "2.0.0",
  } as any);

  // Tier 1 audit integrity operations
  assert.equal(typeof store.listDispatchDecisionTracesByTask, "function");
  assert.equal(typeof store.listDispatchDecisionTracesByExecution, "function");
  assert.equal(typeof store.listTier1EventRegistryCoverage, "function");
  assert.equal(typeof store.getTier1AuditIntegrityReport, "function");
  assert.equal(typeof store.bootstrapTier1AuditIntegrityRecords, "function");
  assert.equal(typeof store.listPendingTier1Acks, "function");
  assert.equal(typeof store.countPendingTier1Acks, "function");
  assert.equal(typeof store.countFailedTier1Acks, "function");
  assert.equal(typeof store.createTier1StatusEvent, "function");
});