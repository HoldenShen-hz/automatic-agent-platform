// Seeded negative sample: loadPlugin is preceded by a verify call on the
// same logical step. The audit:plugin-security script MUST NOT report this.
export async function load(): Promise<unknown> {
  return verify(loadPlugin("my-plugin"));
}
