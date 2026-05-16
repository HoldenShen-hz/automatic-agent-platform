#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const repoRoot = process.cwd();
const domainsRoot = path.join(repoRoot, "src", "domains");
const minBodyLength = 120;
const maxDuplicateGroupsToPrint = 10;

async function listTypeScriptFiles(rootDir) {
  const results = [];
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await listTypeScriptFiles(fullPath));
      continue;
    }
    if (entry.isFile() && fullPath.endsWith(".ts")) {
      results.push(fullPath);
    }
  }
  return results;
}

function normalizeBodyText(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function topLevelDomain(relativePath) {
  const [first] = relativePath.split(path.sep);
  return first ?? "<root>";
}

function buildFunctionId(relativePath, node, sourceFile) {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const name = node.name && "text" in node.name ? node.name.text : "<anonymous>";
  return `${relativePath}:${line + 1}:${name}`;
}

function collectFunctionBodies(filePath, sourceText) {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const relativePath = path.relative(domainsRoot, filePath);
  const functions = [];

  function record(node, body) {
    if (!body) {
      return;
    }
    const normalizedBody = normalizeBodyText(body.getText(sourceFile));
    if (normalizedBody.length < minBodyLength) {
      return;
    }
    functions.push({
      id: buildFunctionId(relativePath, node, sourceFile),
      relativePath,
      topLevelDomain: topLevelDomain(relativePath),
      normalizedBody,
    });
  }

  function visit(node) {
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
      record(node, node.body);
    } else if (ts.isVariableDeclaration(node) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      record(node, node.initializer.body);
    } else if (ts.isPropertyAssignment(node) && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      record(node, node.initializer.body);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return functions;
}

function findDuplicateGroups(functionBodies) {
  const byNormalizedBody = new Map();
  for (const fn of functionBodies) {
    const bucket = byNormalizedBody.get(fn.normalizedBody) ?? [];
    bucket.push(fn);
    byNormalizedBody.set(fn.normalizedBody, bucket);
  }

  return [...byNormalizedBody.values()]
    .filter((group) => group.length > 1)
    .filter((group) => new Set(group.map((entry) => entry.topLevelDomain)).size > 1)
    .sort((left, right) => right.length - left.length);
}

async function main() {
  const files = await listTypeScriptFiles(domainsRoot);
  const functionBodies = [];
  for (const filePath of files) {
    const sourceText = await fs.readFile(filePath, "utf8");
    functionBodies.push(...collectFunctionBodies(filePath, sourceText));
  }

  const duplicateGroups = findDuplicateGroups(functionBodies);
  console.log(`Scanned ${files.length} TypeScript files under src/domains`);
  console.log(`Collected ${functionBodies.length} function-like bodies (normalized length >= ${minBodyLength})`);
  console.log(`Cross-domain duplicate groups: ${duplicateGroups.length}`);

  if (duplicateGroups.length > 0) {
    for (const group of duplicateGroups.slice(0, maxDuplicateGroupsToPrint)) {
      console.log("");
      console.log(`Duplicate group (${group.length} matches across ${new Set(group.map((entry) => entry.topLevelDomain)).size} domains):`);
      for (const entry of group) {
        console.log(`  - ${entry.id}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  console.log("No material cross-domain duplicate function bodies detected.");
}

await main();
