// Seeded negative sample: actualOutput is computed from a real call.
// The audit:eval-oracle script MUST NOT report this.
export function runSample(input: string): string {
  const expectedOutput = "hello world";
  const actualOutput = input.toUpperCase();
  return actualOutput;
}
