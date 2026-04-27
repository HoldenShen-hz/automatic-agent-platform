import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";

const TODO_PATH = "docs_zh/operations/current_todo_list.md";

test("current todo list has no active unchecked tasks", () => {
  const todo = readFileSync(TODO_PATH, "utf8");

  assert.equal(/- \[ \]/.test(todo), false);
  assert.equal(/\|\s*待处理\s*\|/.test(todo), false);
  assert.equal(/\|\s*待运行\s*\|/.test(todo), false);
  assert.equal(/\|\s*有失败\s*\|/.test(todo), false);
});

test("historical failure baseline remains archived rather than active work", () => {
  const todo = readFileSync(TODO_PATH, "utf8");

  assert.match(todo, /## 历史基线归档清单/);
  assert.match(todo, /历史基线已归档/);
  assert.match(todo, /历史未运行已归档/);
  assert.equal((todo.match(/\|\s*已归档\s*\|/g) ?? []).length, 16);
});
