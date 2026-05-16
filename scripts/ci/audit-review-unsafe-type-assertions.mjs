#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const repoRoot = process.cwd();
const srcRoot = path.join(repoRoot, "src");

async function listTypeScriptFiles(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listTypeScriptFiles(fullPath));
      continue;
    }
    if (entry.isFile() && fullPath.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

function syntaxKindName(kind) {
  return ts.SyntaxKind[kind] ?? String(kind);
}

function isAssertionNode(node) {
  return ts.isAsExpression(node) || ts.isTypeAssertionExpression(node);
}

function getAssertionTypeNode(node) {
  return ts.isAsExpression(node) ? node.type : node.type;
}

function getAssertionExpression(node) {
  return ts.isAsExpression(node) ? node.expression : node.expression;
}

function hasDoubleAssertion(node) {
  let current = getAssertionExpression(node);
  while (isAssertionNode(current)) {
    return true;
  }
  return false;
}

function classifyAssertion(node) {
  const typeNode = getAssertionTypeNode(node);
  if (typeNode.kind === ts.SyntaxKind.AnyKeyword) {
    return "as_any";
  }
  if (typeNode.kind === ts.SyntaxKind.NeverKeyword) {
    return "as_never";
  }
  if (hasDoubleAssertion(node)) {
    return "double_assertion";
  }
  return null;
}

async function main() {
  const files = await listTypeScriptFiles(srcRoot);
  const violations = [];

  for (const filePath of files) {
    const sourceText = await fs.readFile(filePath, "utf8");
    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

    function visit(node) {
      if (isAssertionNode(node)) {
        const category = classifyAssertion(node);
        if (category) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          violations.push({
            category,
            file: path.relative(repoRoot, filePath),
            line: line + 1,
            column: character + 1,
            snippet: node.getText(sourceFile),
          });
        }
      }
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  if (violations.length === 0) {
    console.log("Unsafe type assertion audit passed: 0 violations.");
    return;
  }

  console.log(`Unsafe type assertion audit failed: ${violations.length} violation(s).`);
  for (const violation of violations) {
    console.log(`${violation.file}:${violation.line}:${violation.column} [${violation.category}] ${violation.snippet}`);
  }
  process.exitCode = 1;
}

await main();
