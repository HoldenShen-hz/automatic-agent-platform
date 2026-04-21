/**
 * Edit Snapshot Service
 *
 * Provides undo/redo capabilities for file edits using in-memory snapshots.
 * Tracks file changes at the session/step level and allows reverting to previous states.
 *
 * This is a simplified implementation that doesn't require git integration.
 */
import { readFileSync } from "node:fs";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
const editSnapshotLogger = new StructuredLogger({ retentionLimit: 100 });
export class EditSnapshotService {
    editHistory = new Map();
    redoStack = new Map();
    sessionId;
    constructor(sessionId) {
        this.sessionId = sessionId;
    }
    /**
     * Records a file edit for potential undo/redo
     */
    recordEdit(request) {
        const { stepId, filePath, previousContent, newContent } = request;
        const entry = {
            stepId,
            filePath,
            previousContent,
            newContent,
            timestamp: Date.now(),
        };
        // Get or create history for this step
        const history = this.editHistory.get(stepId) ?? [];
        history.push(entry);
        this.editHistory.set(stepId, history);
        // Clear redo stack when a new edit is recorded
        this.redoStack.delete(stepId);
    }
    /**
     * Takes a snapshot of a file at the current point in time
     */
    takeFileSnapshot(filePath) {
        let content;
        try {
            content = readFileSync(filePath, "utf8");
        }
        catch (err) {
            editSnapshotLogger.warn("edit_snapshot: failed to read file for snapshot", { error: err instanceof Error ? err.message : String(err), filePath });
            content = "";
        }
        return {
            filePath,
            content,
            timestamp: Date.now(),
        };
    }
    /**
     * Gets the previous content for a file from the undo stack
     */
    getPreviousContent(stepId, filePath) {
        const history = this.editHistory.get(stepId);
        if (!history || history.length === 0) {
            return null;
        }
        // Find the most recent edit for this file in this step
        for (let i = history.length - 1; i >= 0; i--) {
            const entry = history[i];
            if (entry.filePath === filePath) {
                return entry.previousContent;
            }
        }
        return null;
    }
    /**
     * Gets the content that would be restored by undoing the last edit
     */
    getUndoContent(stepId, filePath) {
        const history = this.editHistory.get(stepId);
        if (!history || history.length === 0) {
            return null;
        }
        // Find the most recent edit for this file
        for (let i = history.length - 1; i >= 0; i--) {
            const entry = history[i];
            if (entry.filePath === filePath) {
                return entry.previousContent;
            }
        }
        return null;
    }
    /**
     * Gets the content that would be restored by redoing the last undone edit
     */
    getRedoContent(stepId, filePath) {
        const stack = this.redoStack.get(stepId);
        if (!stack || stack.length === 0) {
            return null;
        }
        // Find the most recent redo entry for this file
        for (let i = stack.length - 1; i >= 0; i--) {
            const entry = stack[i];
            if (entry.filePath === filePath) {
                return entry.newContent;
            }
        }
        return null;
    }
    /**
     * Performs an undo operation for a step, moving the last edit to the redo stack
     */
    undo(stepId) {
        const history = this.editHistory.get(stepId);
        if (!history || history.length === 0) {
            return null;
        }
        const entry = history.pop();
        this.editHistory.set(stepId, history);
        // Add to redo stack
        const redoStack = this.redoStack.get(stepId) ?? [];
        redoStack.push(entry);
        this.redoStack.set(stepId, redoStack);
        return entry;
    }
    /**
     * Performs a redo operation for a step, moving the last redo entry back to the edit history
     */
    redo(stepId) {
        const stack = this.redoStack.get(stepId);
        if (!stack || stack.length === 0) {
            return null;
        }
        const entry = stack.pop();
        // Add back to edit history
        const history = this.editHistory.get(stepId) ?? [];
        history.push(entry);
        this.editHistory.set(stepId, history);
        return entry;
    }
    /**
     * Gets the undo/redo state for a step
     */
    getState(stepId) {
        const history = this.editHistory.get(stepId) ?? [];
        const redo = this.redoStack.get(stepId) ?? [];
        return {
            canUndo: history.length > 0,
            canRedo: redo.length > 0,
            undoStackDepth: history.length,
            redoStackDepth: redo.length,
        };
    }
    /**
     * Gets all edit history for a step
     */
    getHistory(stepId) {
        return this.editHistory.get(stepId) ?? [];
    }
    /**
     * Clears all history for a step
     */
    clearHistory(stepId) {
        this.editHistory.delete(stepId);
        this.redoStack.delete(stepId);
    }
    /**
     * Clears all history for all steps
     */
    clearAll() {
        this.editHistory.clear();
        this.redoStack.clear();
    }
    /**
     * Gets the session ID
     */
    getSessionId() {
        return this.sessionId;
    }
}
/**
 * Manages edit snapshot services per session
 */
export class EditSnapshotManager {
    services = new Map();
    /**
     * Gets or creates a snapshot service for a session
     */
    getService(sessionId) {
        let service = this.services.get(sessionId);
        if (!service) {
            service = new EditSnapshotService(sessionId);
            this.services.set(sessionId, service);
        }
        return service;
    }
    /**
     * Removes a session's snapshot service
     */
    removeService(sessionId) {
        this.services.delete(sessionId);
    }
    /**
     * Clears all session services
     */
    clearAll() {
        this.services.clear();
    }
}
//# sourceMappingURL=edit-snapshot-service.js.map