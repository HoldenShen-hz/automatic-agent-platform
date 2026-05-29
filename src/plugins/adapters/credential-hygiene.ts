import { createHash } from "node:crypto";

export interface ZeroableCredentialSecret {
  withSecret<T>(consumer: (secret: string) => T): T;
  clear(): void;
}

class InMemoryZeroableCredentialSecret implements ZeroableCredentialSecret {
  private bytes: Buffer | null;

  public constructor(secret: string) {
    this.bytes = Buffer.from(secret, "utf8");
  }

  public withSecret<T>(consumer: (secret: string) => T): T {
    if (this.bytes == null) {
      throw new Error("adapter.credential_unavailable");
    }
    return consumer(this.bytes.toString("utf8"));
  }

  public clear(): void {
    this.bytes?.fill(0);
    this.bytes = null;
  }
}

export function createZeroableCredentialSecret(secret: string): ZeroableCredentialSecret {
  return new InMemoryZeroableCredentialSecret(secret);
}

export function buildHashedCredentialFingerprint(prefix: string, secret: string, length: number = 24): string {
  return `${prefix}_${createHash("sha256").update(secret).digest("hex").slice(0, Math.max(4, length))}`;
}
