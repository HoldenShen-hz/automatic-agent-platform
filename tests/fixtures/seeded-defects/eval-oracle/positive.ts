// Seeded positive sample: actualOutput is set to expectedOutput.
// The audit:eval-oracle script MUST report this.
export function runSample(): boolean {
  const expectedOutput = "hello world";
  const actualOutput = expectedOutput;
  return actualOutput === expectedOutput;
}
