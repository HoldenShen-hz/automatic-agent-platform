// Negative seed for tenancy: a repository call that filters by tenantId.
export async function findUserById(id: string, tenantId: string): Promise<unknown> {
  return db.query(`SELECT * FROM users WHERE id = ${id} AND tenant_id = ${tenantId}`);
}
