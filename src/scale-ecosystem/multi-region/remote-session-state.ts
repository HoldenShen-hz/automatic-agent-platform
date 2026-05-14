export type RemoteSessionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "degraded"
  | "failed"
  | "viewer_only";

export function transitionRemoteSessionState(
  current: RemoteSessionState,
  signal: "connected" | "connection_lost" | "partial_sync" | "hard_failure" | "viewer_mode",
): RemoteSessionState {
  switch (signal) {
    case "connected":
      if (current === "viewer_only") {
        return "viewer_only";
      }
      return current === "failed" ? "connecting" : "connected";
    case "connection_lost":
      return current === "failed" ? "failed" : "reconnecting";
    case "partial_sync":
      return "degraded";
    case "hard_failure":
      return "failed";
    case "viewer_mode":
      return "viewer_only";
    default:
      return current;
  }
}
