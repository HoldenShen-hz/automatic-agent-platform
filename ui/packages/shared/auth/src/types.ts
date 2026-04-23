export interface AuthSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
}

export interface AuthIdentity {
  readonly locale: string;
  readonly displayName: string;
}
