/**
 * Task Board CLI Tool
 *
 * This module provides a command-line interface for viewing the current state
 * of the task board. It retrieves and displays a list of pending tasks from
 * the authoritative runtime database, providing visibility into queued work items.
 *
 * Usage: npm run task-board
 *
 *
 * @see {@link docs_zh/automatic_agent_patform_arthitecture_design.md} for multi-step orchestration architecture
 * @see {@link docs_zh/governance/glossary_and_terminology.md} for task board and queue terminology
 * @see {@link docs_zh/operations/phases/phase-1b-orchestration.md} for orchestration details
 */
import { resolveCliDbPath, withCliStorage } from "./authoritative-storage.js";
import { TaskBoardService } from "../../platform/shared/observability/task-board-service.js";

/**
 * Resolves the path to the SQLite database file used by CLI tools.
 *
 * @returns The absolute path to the SQLite database file
 */
function resolveDbPath(): string {
  return resolveCliDbPath();
}

/**
 * Main entry point for the task board CLI tool.
 *
 * Initializes the database and TaskBoardService, retrieves a list of
 * up to 25 pending task items, and outputs them as formatted JSON.
 * Ensures the database connection is properly closed before exiting.
 */
function main(): void {
  const output = withCliStorage(
    (storage) => {
      const taskBoard = new TaskBoardService(storage.store);
      return { items: taskBoard.list(25) };
    },
    { dbPath: resolveDbPath() },
  );

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main();
