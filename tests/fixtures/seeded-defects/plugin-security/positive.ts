// Seeded positive sample: a loadPlugin call without a preceding verify step.
// The audit:plugin-security script MUST report this.
export async function load(): Promise<unknown> {
  const plugin = await loadPlugin("my-plugin");
  return plugin;
}
