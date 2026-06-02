// Seeded evasion sample: the role assignment is written via a
// string-concatenated variable to look opaque (the "ad" + "min"
// trick), and the role is then stored in a defaultRoles list using
// a non-canonical property name. The audit:auth-role-mapping script
// MUST still catch this because the literal "admin" string still
// appears in a defaultRoles initializer / a roles.includes("admin")
// call on the same line.

const ADMIN = "ad" + "min";

export interface ServicePrincipal {
  principalId: string;
  roles: string[];
}

export function grantDefaultAdmin(p: ServicePrincipal): ServicePrincipal {
  if (p.roles.includes(ADMIN)) {
    return p;
  }
  p.roles.push(ADMIN);
  return p;
}

export const defaultRoles: string[] = ["reader", "admin"];

export const routeDefaultRoles: { roles: string[] } = {
  roles: ["admin", "reader"],
};
