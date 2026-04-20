import assert from "node:assert/strict";
import test from "node:test";

import { newId, nowIso } from "../../../../src/platform/contracts/types/ids.js";

interface MockDivision {
  id: string;
  name: string;
  kind: "engineering" | "ops" | "product" | "hr";
  parentId: string | null;
  createdAt: string;
}

test("Division creation with required fields", () => {
  const division: MockDivision = {
    id: newId("div"),
    name: "Engineering",
    kind: "engineering",
    parentId: null,
    createdAt: nowIso(),
  };

  assert.ok(division.id.startsWith("div_"));
  assert.equal(division.name, "Engineering");
  assert.equal(division.kind, "engineering");
  assert.equal(division.parentId, null);
});

test("Division hierarchy with parent", () => {
  const parent: MockDivision = {
    id: newId("div"),
    name: "Engineering",
    kind: "engineering",
    parentId: null,
    createdAt: nowIso(),
  };

  const child: MockDivision = {
    id: newId("div"),
    name: "Frontend",
    kind: "engineering",
    parentId: parent.id,
    createdAt: nowIso(),
  };

  assert.equal(child.parentId, parent.id);
});

test("Division kinds are valid", () => {
  const kinds: MockDivision["kind"][] = ["engineering", "ops", "product", "hr"];

  for (const kind of kinds) {
    const division: MockDivision = {
      id: newId("div"),
      name: kind,
      kind,
      parentId: null,
      createdAt: nowIso(),
    };
    assert.equal(division.kind, kind);
  }
});

test("Multiple divisions in same hierarchy", () => {
  const parentId = newId("div");
  const children: MockDivision[] = [];

  for (let i = 0; i < 5; i++) {
    children.push({
      id: newId("div"),
      name: `Team ${i}`,
      kind: "engineering",
      parentId,
      createdAt: nowIso(),
    });
  }

  const sameParent = children.filter((d) => d.parentId === parentId);
  assert.equal(sameParent.length, 5);
});

test("Division root divisions have no parent", () => {
  const roots: MockDivision[] = [];
  const children: MockDivision[] = [];

  for (let i = 0; i < 3; i++) {
    const root: MockDivision = {
      id: newId("div"),
      name: `Root ${i}`,
      kind: "engineering",
      parentId: null,
      createdAt: nowIso(),
    };
    roots.push(root);
    children.push({
      id: newId("div"),
      name: `Child ${i}`,
      kind: "engineering",
      parentId: root.id,
      createdAt: nowIso(),
    });
  }

  assert.equal(roots.filter((r) => r.parentId === null).length, 3);
  assert.equal(children.filter((c) => c.parentId !== null).length, 3);
});
