import { estimateTextTokens } from "../../../model-gateway/messages/token-estimator.js";
import { newId } from "../../../contracts/types/ids.js";

import type { SqliteConnection } from "./query-helper.js";

const TERMINAL_SESSION_STATUSES = new Set(["completed", "failed", "cancelled"]);

interface SessionRow {
  taskId: string | null;
}

interface MessagePreviewRow {
  direction: string;
  messageType: string;
  content: string | null;
}

function buildSummaryText(rows: MessagePreviewRow[], terminalStatus: string): string | null {
  const normalized = rows
    .map((row) => {
      const content = (row.content ?? "").trim().replace(/\s+/g, " ");
      if (content.length === 0) {
        return null;
      }
      const preview = content.length > 180 ? `${content.slice(0, 177)}...` : content;
      return `${row.direction}/${row.messageType}: ${preview}`;
    })
    .filter((value): value is string => value != null);
  if (normalized.length === 0) {
    return null;
  }

  return `Session reached ${terminalStatus}. Recent exchange summary: ${normalized.join(" | ")}`;
}

export function maybeCreateTerminalSessionSummary(
  connection: SqliteConnection,
  sessionId: string,
  terminalStatus: string,
  createdAt: string,
): void {
  if (!TERMINAL_SESSION_STATUSES.has(terminalStatus)) {
    return;
  }

  const existing = connection
    .prepare(`SELECT id FROM session_summaries WHERE session_id = ? LIMIT 1`)
    .get(sessionId) as { id: string } | undefined;
  if (existing) {
    return;
  }

  const session = connection
    .prepare(`SELECT task_id AS taskId FROM sessions WHERE id = ? LIMIT 1`)
    .get(sessionId) as SessionRow | undefined;
  if (!session) {
    return;
  }

  const messageRows = connection
    .prepare(
      `SELECT direction, message_type AS messageType, content
       FROM messages
       WHERE session_id = ?
         AND TRIM(COALESCE(content, '')) <> ''
       ORDER BY created_at DESC, id DESC
       LIMIT 6`,
    )
    .all(sessionId) as unknown as MessagePreviewRow[];
  if (messageRows.length === 0) {
    return;
  }

  const summaryText = buildSummaryText([...messageRows].reverse(), terminalStatus);
  if (summaryText == null) {
    return;
  }

  connection
    .prepare(
      `INSERT INTO session_summaries (
        id, session_id, task_id, agent_id, summary_text,
        key_decisions, key_outcomes, memory_ids_referenced,
        token_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      newId("summ"),
      sessionId,
      session.taskId,
      null,
      summaryText,
      null,
      JSON.stringify([`session_${terminalStatus}`]),
      null,
      estimateTextTokens(summaryText),
      createdAt,
    );
}
