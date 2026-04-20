import assert from "node:assert/strict";
import test from "node:test";

import { newId, nowIso } from "../../../../src/platform/contracts/types/ids.js";

interface MockHRRole {
  id: string;
  name: string;
  divisionId: string;
  permissions: string[];
  createdAt: string;
}

test("HR Role creation with required fields", () => {
  const role: MockHRRole = {
    id: newId("role"),
    name: "Engineer",
    divisionId: newId("div"),
    permissions: ["read", "write"],
    createdAt: nowIso(),
  };

  assert.ok(role.id.startsWith("role_"));
  assert.equal(role.name, "Engineer");
  assert.ok(Array.isArray(role.permissions));
});

test("HR Role with multiple permissions", () => {
  const permissions = ["read", "write", "execute", "admin", "delete"];
  const role: MockHRRole = {
    id: newId("role"),
    name: "Admin",
    divisionId: newId("div"),
    permissions,
    createdAt: nowIso(),
  };

  assert.equal(role.permissions.length, 5);
  assert.ok(role.permissions.includes("admin"));
});

test("HR Role permissions are unique", () => {
  const permissions = ["read", "read", "write", "write", "read"];
  const unique = [...new Set(permissions)];

  const role: MockHRRole = {
    id: newId("role"),
    name: "Clean Role",
    divisionId: newId("div"),
    permissions: unique,
    createdAt: nowIso(),
  };

  assert.equal(role.permissions.length, 2);
});

test("Multiple roles for same division", () => {
  const divisionId = newId("div");
  const roles: MockHRRole[] = [];

  for (let i = 0; i < 4; i++) {
    roles.push({
      id: newId("role"),
      name: `Role ${i}`,
      divisionId,
      permissions: ["read"],
      createdAt: nowIso(),
    });
  }

  const sameDivision = roles.filter((r) => r.divisionId === divisionId);
  assert.equal(sameDivision.length, 4);
});

test("Role permission check", () => {
  const role: MockHRRole = {
    id: newId("role"),
    name: "Developer",
    divisionId: newId("div"),
    permissions: ["read", "write", "execute"],
    createdAt: nowIso(),
  };

  assert.ok(role.permissions.includes("read"));
  assert.ok(!role.permissions.includes("delete"));
});
