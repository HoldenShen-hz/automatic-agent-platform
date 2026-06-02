// Positive seed for tenancy: a repository call with no org filter.
export async function findUserById(id: string): Promise<unknown> {
  return db.query(`SELECT * FROM users WHERE id = ${id}`);
}
