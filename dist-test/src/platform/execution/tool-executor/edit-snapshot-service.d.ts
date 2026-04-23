/**
 * Edit Snapshot Service
 *
 * Provides undo/redo capabilities for file edits using in-memory snapshots.
 * Tracks file changes at the session/step level and allows reverting to previous states.
 *
 * This is a simplified implementation that doesn't require git integration.
 */
export interface FileSnapshot {
    filePath: string;
    content: string;
    timestamp: number;
}
export interface EditHistoryEntry {
    stepId: string;
    filePath: string;
    previousContent: string;
    newContent: string;
    timestamp: number;
}
export interface UndoRedoState {
    canUndo: boolean;
    canRedo: boolean;
    undoStackDepth: number;
    redoStackDepth: number;
}
export declare class EditSnapshotService {
    private editHistory;
    private redoStack;
    private sessionId;
    constructor(sessionId: string);
    /**
     * Records a file edit for potential undo/redo
     */
    recordEdit(request: {
        stepId: string;
        filePath: string;
        previousContent: string;
        newContent: string;
    }): void;
    /**
     * Takes a snapshot of a file at the current point in time
     */
    takeFileSnapshot(filePath: string): FileSnapshot;
    /**
     * Gets the previous content for a file from the undo stack
     */
    getPreviousContent(stepId: string, filePath: string): string | null;
    /**
     * Gets the content that would be restored by undoing the last edit
     */
    getUndoContent(stepId: string, filePath: string): string | null;
    /**
     * Gets the content that would be restored by redoing the last undone edit
     */
    getRedoContent(stepId: string, filePath: string): string | null;
    /**
     * Performs an undo operation for a step, moving the last edit to the redo stack
     */
    undo(stepId: string): EditHistoryEntry | null;
    /**
     * Performs a redo operation for a step, moving the last redo entry back to the edit history
     */
    redo(stepId: string): EditHistoryEntry | null;
    /**
     * Gets the undo/redo state for a step
     */
    getState(stepId: string): UndoRedoState;
    /**
     * Gets all edit history for a step
     */
    getHistory(stepId: string): readonly EditHistoryEntry[];
    /**
     * Clears all history for a step
     */
    clearHistory(stepId: string): void;
    /**
     * Clears all history for all steps
     */
    clearAll(): void;
    /**
     * Gets the session ID
     */
    getSessionId(): string;
}
/**
 * Manages edit snapshot services per session
 */
export declare class EditSnapshotManager {
    private services;
    /**
     * Gets or creates a snapshot service for a session
     */
    getService(sessionId: string): EditSnapshotService;
    /**
     * Removes a session's snapshot service
     */
    removeService(sessionId: string): void;
    /**
     * Clears all session services
     */
    clearAll(): void;
}
