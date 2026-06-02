// Seeded negative sample: a "token" identifier but the value is a redacted
// placeholder. The audit:secret-sinks script MUST NOT report this.
const REDACTED = "[REDACTED]";

export function logRedacted(): void {
  console.log({ token: "[REDACTED]" });
  console.info("secret redacted", { secret: "[REDACTED]" });
}

export function throwRedacted(): never {
  throw new Error(`failed: token=[REDACTED]`);
}
