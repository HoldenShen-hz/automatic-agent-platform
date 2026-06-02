// Seeded positive sample: a real secret leak into a logger sink.
// The audit:secret-sinks script MUST report this.
const bearerToken = "sk-test-EXAMPLE-not-a-real-secret";
const apiKey = "ak-test-EXAMPLE";

export function logToken(): void {
  console.log({ token: bearerToken });
}

export function throwWithSecret(): never {
  throw new Error(`failed with token=${bearerToken}`);
}

export function publishSecret(): void {
  eventBus.publish({ authorization: bearerToken });
}

export function recordSecret(): void {
  audit.record({ metadata: { apiKey } });
}
