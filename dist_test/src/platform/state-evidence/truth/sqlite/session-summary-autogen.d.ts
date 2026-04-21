import type { SqliteConnection } from "./query-helper.js";
export declare function maybeCreateTerminalSessionSummary(connection: SqliteConnection, sessionId: string, terminalStatus: string, createdAt: string): void;
