// Seeded evasion sample: secret identifier built via string concatenation
// to bypass naive regex scanners. The audit:secret-sinks script MUST still
// catch this when it actually reaches a sink with a token name on the
// same line. The variable names retain the audit signal.
const k = "api" + "Key";
const secretValue = "sk-test-EVADED-EXAMPLE";
const bearerVar = secretValue;

export function logEvasion(): void {
  console.log({ [k]: bearerVar });
}

export function throwEvasion(): never {
  throw new Error(`failed with key=${bearerVar}`);
}
