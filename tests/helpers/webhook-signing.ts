import { createHmac } from "node:crypto";

export const TEST_WEBHOOK_SIGNING_SECRET = "test-webhook-signing-secret";

export function signWebhookBody(body: string, signingSecret: string = TEST_WEBHOOK_SIGNING_SECRET): string {
  const signature = createHmac("sha256", signingSecret).update(body).digest("hex");
  return `sha256=${signature}`;
}

export function createSignedWebhookHeaders(
  body: string,
  options: {
    signingSecret?: string;
    signatureHeader?: string;
    idempotencyKey?: string;
    idempotencyHeader?: string;
  } = {},
): Record<string, string> {
  const signatureHeader = options.signatureHeader ?? "x-aa-signature";
  const idempotencyHeader = options.idempotencyHeader ?? "idempotency-key";
  const headers: Record<string, string> = {
    [signatureHeader]: signWebhookBody(body, options.signingSecret ?? TEST_WEBHOOK_SIGNING_SECRET),
  };
  if (options.idempotencyKey != null) {
    headers[idempotencyHeader] = options.idempotencyKey;
  }
  return headers;
}
