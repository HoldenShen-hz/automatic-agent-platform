// Seeded evasion sample: actualOutput is renamed via destructuring but the
// line still contains the equality `actual === expected` shape.
// The audit:eval-oracle script MUST still report this.
export function runSample(): boolean {
  const expectedOutput = "hello";
  const actualOutput = expectedOutput;
  return actualOutput === expectedOutput;
}
