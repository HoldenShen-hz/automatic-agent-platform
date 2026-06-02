// Seeded evasion sample: the call is in an arrow function that does not
// return the promise. The audit:fire-and-forget script MUST still report
// this because the .publish(...) expression statement is fire-and-forget.
export const something = { publish: async (_msg: string): Promise<void> => {} };

export const fireIt = (): void => {
  something.publish("hi");
};
