import { TokenManager } from "./token-manager";
import type { AuthSession } from "./types";

export class SessionGuard {
  public constructor(private readonly tokenManager: TokenManager = new TokenManager()) {}

  public requireAuthenticated(): AuthSession {
    const session = this.tokenManager.getSession();
    if (session == null || this.tokenManager.isExpired()) {
      throw new Error("auth.session_required");
    }
    return session;
  }
}
