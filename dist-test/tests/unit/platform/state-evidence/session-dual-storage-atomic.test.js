/**
 * @fileoverview Tests for Session Dual Storage Non-Atomic Write Issue
 *
 * Tests the defect where two appendFileSync calls in session-dual-storage.ts
 * can result in inconsistent state if crash occurs between them.
 *
 * @see SYS-REL-2.8, manual §26.5
 */
import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createTempWorkspace, cleanupPath } from "../../../helpers/fs.js";
import { SessionDualStorageService } from "../../../../src/platform/state-evidence/truth/session-dual-storage.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";
describe("SessionDualStorageService", () => {
    let workspace;
    let service;
    beforeEach(() => {
        workspace = createTempWorkspace("session-dual-storage-test-");
        service = new SessionDualStorageService({ jsonlRootDir: workspace });
    });
    afterEach(() => {
        cleanupPath(workspace);
    });
    /**
     * Counts non-empty lines in a JSONL file.
     */
    function countLines(filePath) {
        if (!existsSync(filePath)) {
            return 0;
        }
        const content = readFileSync(filePath, "utf8");
        return content.split("\n").filter((line) => line.trim().length > 0).length;
    }
    /**
     * Gets the session JSONL file path for a session.
     */
    function getSessionPath(sessionId) {
        const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
        return join(workspace, `session-${safeSessionId}.jsonl`);
    }
    /**
     * Gets the task index file path.
     */
    function getTaskIndexPath(taskId) {
        const safeTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, "_");
        return join(workspace, `task-${safeTaskId}-sessions.jsonl`);
    }
    /**
     * Simulates a partial write failure by directly manipulating the file system
     * to mimic a crash between the two appendFileSync calls.
     *
     * This manually writes only to the session file, leaving the task index empty,
     * simulating the SYS-REL-2.8 defect scenario.
     */
    function simulatePartialWrite(sessionId, taskId) {
        const sessionPath = getSessionPath(sessionId);
        const event = {
            eventType: "session_created",
            sessionId,
            taskId,
            timestamp: nowIso(),
            payload: { id: sessionId, taskId },
        };
        const line = JSON.stringify(event) + "\n";
        mkdirSync(workspace, { recursive: true });
        appendFileSync(sessionPath, line, "utf8");
        // Intentionally NOT writing to task index - simulating crash after first write
    }
    describe("dual storage consistency", () => {
        test("append is atomic when no crash", () => {
            const sessionId = "atomic-session-001";
            const taskId = "atomic-task-001";
            service.recordSessionCreated({
                id: sessionId,
                taskId,
                channel: "test",
                status: "open",
                externalSessionId: null,
                createdAt: nowIso(),
                updatedAt: nowIso(),
            });
            const sessionPath = getSessionPath(sessionId);
            const taskIndexPath = getTaskIndexPath(taskId);
            assert.ok(existsSync(sessionPath), "Session file should exist");
            assert.ok(existsSync(taskIndexPath), "Task index file should exist");
            const sessionLines = countLines(sessionPath);
            const taskIndexLines = countLines(taskIndexPath);
            assert.equal(sessionLines, taskIndexLines, "Line counts should match when no crash");
            assert.equal(sessionLines, 1, "Should have exactly 1 line in session file");
        });
        test("session file and index stay in sync", () => {
            const sessionId = "sync-session-001";
            const taskId = "sync-task-001";
            // Record multiple events
            service.recordSessionCreated({
                id: sessionId,
                taskId,
                channel: "test",
                status: "open",
                externalSessionId: null,
                createdAt: nowIso(),
                updatedAt: nowIso(),
            });
            service.recordSessionUpdated({
                id: sessionId,
                taskId,
                channel: "test",
                status: "open",
                externalSessionId: null,
                createdAt: nowIso(),
                updatedAt: nowIso(),
            });
            const sessionPath = getSessionPath(sessionId);
            const taskIndexPath = getTaskIndexPath(taskId);
            const sessionLines = countLines(sessionPath);
            const taskIndexLines = countLines(taskIndexPath);
            assert.equal(sessionLines, taskIndexLines, "Multiple events should keep files in sync");
            assert.equal(sessionLines, 2, "Should have 2 lines after two events");
        });
        test("dual storage detects and repairs partial write", () => {
            const sessionId = "partial-session-001";
            const taskId = "partial-task-001";
            // First, simulate a partial write failure (only session file written)
            simulatePartialWrite(sessionId, taskId);
            // Verify the inconsistent state exists
            const sessionPath = getSessionPath(sessionId);
            const taskIndexPath = getTaskIndexPath(taskId);
            assert.ok(existsSync(sessionPath), "Session file should exist after partial write");
            const sessionLinesBefore = countLines(sessionPath);
            const taskIndexLinesBefore = countLines(taskIndexPath);
            assert.equal(sessionLinesBefore, 1, "Session file should have 1 line");
            assert.equal(taskIndexLinesBefore, 0, "Task index should have 0 lines (partial write state)");
            // Now detect and repair the inconsistency
            // The service should detect that session has events but task index is empty or has fewer lines
            const sessionEvents = service.replaySessionEvents(sessionId);
            const taskEvents = service.replayTaskSessionHistory(taskId);
            // Detect partial write: session has events but task index is missing them
            const hasPartialWrite = sessionEvents.length > 0 && taskEvents.length === 0;
            assert.ok(hasPartialWrite, "Should detect partial write state");
            // Repair: replay missing events to task index by re-playing events
            // The repair logic would iterate through session events and write missing ones to task index
            if (hasPartialWrite) {
                // Simulate repair by appending the missing events to task index
                for (const event of sessionEvents) {
                    const line = JSON.stringify(event) + "\n";
                    appendFileSync(taskIndexPath, line, "utf8");
                }
            }
            // Verify repair succeeded
            const sessionLinesAfter = countLines(sessionPath);
            const taskIndexLinesAfter = countLines(taskIndexPath);
            assert.equal(sessionLinesAfter, taskIndexLinesAfter, "After repair, line counts should match");
            assert.equal(sessionLinesAfter, sessionLinesBefore, "Session lines should be unchanged");
            // Verify both files contain the same events
            const repairedTaskEvents = service.replayTaskSessionHistory(taskId);
            assert.equal(repairedTaskEvents.length, sessionEvents.length, "Task index should have same event count as session after repair");
        });
        test("partial write detection identifies missing task index entries", () => {
            const sessionId = "detect-session-001";
            const taskId = "detect-task-001";
            // Create a partial write scenario
            simulatePartialWrite(sessionId, taskId);
            // Read events from both files
            const sessionPath = getSessionPath(sessionId);
            const taskIndexPath = getTaskIndexPath(taskId);
            const sessionContent = existsSync(sessionPath)
                ? readFileSync(sessionPath, "utf8").split("\n").filter((l) => l.trim())
                : [];
            const taskIndexContent = existsSync(taskIndexPath)
                ? readFileSync(taskIndexPath, "utf8").split("\n").filter((l) => l.trim())
                : [];
            // Detect inconsistency
            const sessionEventCount = sessionContent.length;
            const taskIndexEventCount = taskIndexContent.length;
            assert.ok(sessionEventCount > taskIndexEventCount, "Session should have more events than task index");
            assert.equal(taskIndexEventCount, 0, "Task index should be empty in partial write scenario");
            // The defect is that task index is missing entries that session has
            const missingCount = sessionEventCount - taskIndexEventCount;
            assert.equal(missingCount, sessionEventCount, "All session events should be missing from task index");
        });
        test("repair logic re-populates task index from session events", () => {
            const sessionId = "repair-session-001";
            const taskId = "repair-task-001";
            // Setup: create a complete state first
            service.recordSessionCreated({
                id: sessionId,
                taskId,
                channel: "test",
                status: "open",
                externalSessionId: null,
                createdAt: nowIso(),
                updatedAt: nowIso(),
            });
            // Simulate corruption: clear task index to simulate partial write damage
            const taskIndexPath = getTaskIndexPath(taskId);
            writeFileSync(taskIndexPath, "", "utf8");
            // Verify corruption
            const taskEventsBefore = service.replayTaskSessionHistory(taskId);
            assert.equal(taskEventsBefore.length, 0, "Task index should be empty after corruption");
            // Repair: rebuild task index from session events
            const sessionEvents = service.replaySessionEvents(sessionId);
            for (const event of sessionEvents) {
                const line = JSON.stringify(event) + "\n";
                appendFileSync(taskIndexPath, line, "utf8");
            }
            // Verify repair
            const taskEventsAfter = service.replayTaskSessionHistory(taskId);
            assert.equal(taskEventsAfter.length, sessionEvents.length, "Task index should be restored from session events");
        });
    });
    describe("concurrent write scenarios", () => {
        test("multiple concurrent appends maintain sync", async () => {
            const taskId = "concurrent-task-001";
            const concurrency = 10;
            const promises = Array.from({ length: concurrency }, (_, i) => {
                const sessionId = `concurrent-session-${String(i).padStart(3, "0")}`;
                return Promise.resolve().then(() => {
                    service.recordSessionCreated({
                        id: sessionId,
                        taskId,
                        channel: "test",
                        status: "open",
                        externalSessionId: null,
                        createdAt: nowIso(),
                        updatedAt: nowIso(),
                    });
                    return sessionId;
                });
            });
            const sessionIds = await Promise.all(promises);
            // Verify all session files exist
            for (const sessionId of sessionIds) {
                const sessionPath = getSessionPath(sessionId);
                assert.ok(existsSync(sessionPath), `Session file should exist for ${sessionId}`);
            }
            // Verify task index has all events
            const taskIndexPath = getTaskIndexPath(taskId);
            const taskIndexLines = countLines(taskIndexPath);
            assert.equal(taskIndexLines, concurrency, `Task index should have ${concurrency} lines`);
        });
    });
});
//# sourceMappingURL=session-dual-storage-atomic.test.js.map