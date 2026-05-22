export async function handleQuery(input: { query: string }) {
  return { result: `Processed: ${input.query}` };
}