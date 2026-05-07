import type { BudgetIntent, HarnessRun, TaskDraft, UserConfirmationReceipt } from "../../../contracts/executable-contracts/index.js";
import type { AuthoritativeSqlDatabase } from "../../../state-evidence/truth/authoritative-sql-database.js";
import type { ClarificationSession, ClarificationSessionStage } from "./intake-admission-service.js";

export interface PersistedClarificationSessionRecord {
  readonly session: ClarificationSession;
  readonly taskDraft: TaskDraft;
  readonly harnessRun: HarnessRun;
  readonly budgetIntent: BudgetIntent;
}

export interface ClarificationSessionRepository {
  save(record: PersistedClarificationSessionRecord): void;
  get(sessionId: string): PersistedClarificationSessionRecord | null;
  updateSession(
    sessionId: string,
    stage: ClarificationSessionStage,
    confirmationReceipt: UserConfirmationReceipt | null,
  ): PersistedClarificationSessionRecord | null;
}

export class InMemoryClarificationSessionRepository implements ClarificationSessionRepository {
  private readonly records = new Map<string, PersistedClarificationSessionRecord>();

  public save(record: PersistedClarificationSessionRecord): void {
    this.records.set(record.session.sessionId, record);
  }

  public get(sessionId: string): PersistedClarificationSessionRecord | null {
    return this.records.get(sessionId) ?? null;
  }

  public updateSession(
    sessionId: string,
    stage: ClarificationSessionStage,
    confirmationReceipt: UserConfirmationReceipt | null,
  ): PersistedClarificationSessionRecord | null {
    const existing = this.records.get(sessionId);
    if (!existing) {
      return null;
    }
    const updated: PersistedClarificationSessionRecord = {
      ...existing,
      session: {
        ...existing.session,
        stage,
        confirmationReceipt,
      },
    };
    this.records.set(sessionId, updated);
    return updated;
  }
}

export class SqlClarificationSessionRepository implements ClarificationSessionRepository {
  public constructor(private readonly db: AuthoritativeSqlDatabase) {
    this.db.connection.exec(`
      CREATE TABLE IF NOT EXISTS clarification_sessions (
        session_id TEXT PRIMARY KEY,
        stage TEXT NOT NULL,
        task_draft_json TEXT NOT NULL,
        harness_run_json TEXT NOT NULL,
        budget_intent_json TEXT NOT NULL,
        session_json TEXT NOT NULL
      )
    `);
  }

  public save(record: PersistedClarificationSessionRecord): void {
    this.db.connection
      .prepare(`
        INSERT INTO clarification_sessions (
          session_id,
          stage,
          task_draft_json,
          harness_run_json,
          budget_intent_json,
          session_json
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          stage = excluded.stage,
          task_draft_json = excluded.task_draft_json,
          harness_run_json = excluded.harness_run_json,
          budget_intent_json = excluded.budget_intent_json,
          session_json = excluded.session_json
      `)
      .run(
        record.session.sessionId,
        record.session.stage,
        JSON.stringify(record.taskDraft),
        JSON.stringify(record.harnessRun),
        JSON.stringify(record.budgetIntent),
        JSON.stringify(record.session),
      );
  }

  public get(sessionId: string): PersistedClarificationSessionRecord | null {
    const row = this.db.connection
      .prepare(`
        SELECT session_json, task_draft_json, harness_run_json, budget_intent_json
        FROM clarification_sessions
        WHERE session_id = ?
      `)
      .get(sessionId) as
      | {
          session_json: string;
          task_draft_json: string;
          harness_run_json: string;
          budget_intent_json: string;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      session: JSON.parse(row.session_json) as ClarificationSession,
      taskDraft: JSON.parse(row.task_draft_json) as TaskDraft,
      harnessRun: JSON.parse(row.harness_run_json) as HarnessRun,
      budgetIntent: JSON.parse(row.budget_intent_json) as BudgetIntent,
    };
  }

  public updateSession(
    sessionId: string,
    stage: ClarificationSessionStage,
    confirmationReceipt: UserConfirmationReceipt | null,
  ): PersistedClarificationSessionRecord | null {
    const existing = this.get(sessionId);
    if (!existing) {
      return null;
    }
    const updated: PersistedClarificationSessionRecord = {
      ...existing,
      session: {
        ...existing.session,
        stage,
        confirmationReceipt,
      },
    };
    this.save(updated);
    return updated;
  }
}
