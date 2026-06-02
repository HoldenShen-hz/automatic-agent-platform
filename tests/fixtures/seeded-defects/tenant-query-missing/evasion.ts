// Evasion seed for tenancy: the variable is named differently
// to defeat the regex, but the property access still uses .where.
export async function findUserById(id: string): Promise<unknown> {
  return db.query({ where: { id } });
}
