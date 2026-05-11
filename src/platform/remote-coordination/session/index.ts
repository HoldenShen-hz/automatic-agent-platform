import type { RemoteSessionStatus } from "../../contracts/types/domain.js";

export interface RemoteWorkerSession {
  sessionId: string;
  workerId: string;
  status: RemoteSessionStatus;
  connectedAt: string | null;
  lastHeartbeatAt: string | null;
  viewerOnly: boolean;
}

export function canRemoteSessionMutate(status: RemoteSessionStatus): boolean {
  return status !== "viewer_only" && status !== "failed" && status !== "connecting";
}
