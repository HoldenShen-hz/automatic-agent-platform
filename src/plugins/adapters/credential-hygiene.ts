import { createHash, randomBytes } from "node:crypto";

export interface ZeroableCredentialSecret {
  withSecretBytes<T>(consumer: (secret: Buffer) => T): T;
  clear(): void;
}

class InMemoryZeroableCredentialSecret implements ZeroableCredentialSecret {
  private bytes: Buffer | null;

  public constructor(secret: string) {
    this.bytes = Buffer.from(secret, "utf8");
  }

  public withSecretBytes<T>(consumer: (secret: Buffer) => T): T {
    if (this.bytes == null) {
      throw new Error("adapter.credential_unavailable");
    }
    return consumer(Buffer.from(this.bytes));
  }

  public clear(): void {
    this.bytes?.fill(0);
    this.bytes = null;
  }
}

export function createZeroableCredentialSecret(secret: string): ZeroableCredentialSecret {
  return new InMemoryZeroableCredentialSecret(secret);
}

const processCredentialFingerprintSalt = randomBytes(16).toString("hex");

export function buildHashedCredentialFingerprint(
  prefix: string,
  secret: string,
  length: number = 24,
  scopeSalt: string = processCredentialFingerprintSalt,
): string {
  return `${prefix}_${createHash("sha256")
    .update(`${scopeSalt}\0${prefix}\0${secret}`)
    .digest("hex")
    .slice(0, Math.max(12, length))}`;
}
