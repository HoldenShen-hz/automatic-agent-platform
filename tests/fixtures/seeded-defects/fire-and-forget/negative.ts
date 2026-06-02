// Seeded negative sample: same call, but awaited. MUST NOT be reported.
export const something = { publish: async (_msg: string): Promise<void> => {} };

export async function fireItAwaited(): Promise<void> {
  await something.publish("hi");
}
