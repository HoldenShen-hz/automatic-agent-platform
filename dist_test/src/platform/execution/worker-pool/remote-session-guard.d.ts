/**
 * @fileoverview Remote Session Guard - Validates remote worker session authority.
 *
 * Remote workers operate in a different environment than the local coordinator
 * and require special validation to ensure they have proper authority to act
 * on behalf of the system. This module determines when remote session authority
 * is blocked due to:
 * - Session being viewer-only (read-only access)
 * - Session consistency check failure
 * - Workspace sync conflicts
 * - Missing stream resume offset
 *
 * These checks prevent remote workers from making decisions or taking actions
 * when their session state is not properly established or has diverged.
 *
 * @see Remote Worker Registration: remote-worker-registration-service.ts
 */
import type { RemoteSessionStatus, SessionConsistencyCheckStatus, WorkspaceSyncStatus, WorkerPlacement } from "../../contracts/types/domain.js";
/** Reasons why a remote worker may be blocked from acting. */
export type RemoteAuthorityBlockReason = "remote_session_viewer_only" | "remote_session_consistency_mismatch" | "remote_workspace_sync_conflict" | "remote_session_resume_offset_missing";
/**
 * State snapshot of remote session authority for a worker.
 *
 * Captures the placement, session status, stream offset, consistency check
 * status, and workspace sync status needed to evaluate authority.
 */
export interface RemoteSessionAuthorityState {
    placement: WorkerPlacement | null | undefined;
    remoteSessionStatus: RemoteSessionStatus | null | undefined;
    lastAcknowledgedStreamOffset: string | null | undefined;
    sessionConsistencyCheckStatus: SessionConsistencyCheckStatus | null | undefined;
    workspaceSyncStatus: WorkspaceSyncStatus | null | undefined;
}
/**
 * Resolves whether a remote worker is blocked from acting.
 *
 * Evaluates the remote session authority state against several conditions
 * that would prevent the worker from making progress. Returns the specific
 * reason code if blocked, or null if the worker has authority to proceed.
 */
export declare function resolveRemoteAuthorityBlockReason(state: RemoteSessionAuthorityState): RemoteAuthorityBlockReason | null;
