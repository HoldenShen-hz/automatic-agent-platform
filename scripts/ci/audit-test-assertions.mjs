#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const ROOTS = ["tests", "ui/tests"];
const TEST_FILE_PATTERN = /\.test\.(?:ts|tsx)$/;
const SKIP_DIRECTORIES = new Set(["node_modules", "dist", "coverage"]);
const ASSERTION_CALLEES = new Set(["assert", "expect", "expectTypeOf"]);
const TEST_HOOK_METHODS = new Set(["after", "afterEach", "before", "beforeEach", "skip", "todo"]);
const ASSERTION_MODULE_PATTERNS = [
  "assert",
  "node:assert",
  "node:assert/strict",
  "chai",
  "vitest",
  "expect-type",
];
const findings = [];

for (const root of ROOTS) {
  if (existsSync(root)) {
    walk(root);
  }
}

const summary = {
  roots: ROOTS,
  findingCount: findings.length,
  findings,
};

console.log(JSON.stringify(summary, null, 2));

if (findings.length > 0) {
  console.error("test assertion audit failed");
  process.exit(1);
}

function walk(directory) {
  for (const entry of readdirSync(directory).sort()) {
    if (SKIP_DIRECTORIES.has(entry)) {
      continue;
    }
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!stats.isFile() || !TEST_FILE_PATTERN.test(fullPath)) {
      continue;
    }
    scanFile(fullPath);
  }
}

function scanFile(file) {
  const source = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, inferScriptKind(file));
  const localFunctions = buildLocalFunctionMap(sourceFile);
  const localTestWrappers = buildLocalTestWrapperMap(sourceFile);
  const assertionIdentifiers = buildAssertionIdentifierSet(sourceFile);
  visit(sourceFile);

  function visit(node) {
    if (ts.isCallExpression(node) && isTestInvocation(node) && !isWrappedInnerTestInvocation(node, localTestWrappers)) {
      inspectTest(node);
    } else if (ts.isCallExpression(node) && isWrappedTestInvocation(node, localTestWrappers)) {
      inspectWrappedTest(node);
    }
    ts.forEachChild(node, visit);
  }

  function inspectTest(node) {
    const callback = node.arguments.find((argument) =>
      ts.isArrowFunction(argument) || ts.isFunctionExpression(argument),
    );
    if (callback == null) {
      return;
    }
    if (containsAssertion(callback.body, localFunctions, assertionIdentifiers)) {
      return;
    }
    const title = readTestTitle(node.arguments[0]);
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    findings.push({
      file,
      line: line + 1,
      title,
    });
  }

  function inspectWrappedTest(node) {
    const callback = node.arguments.find((argument) =>
      ts.isArrowFunction(argument) || ts.isFunctionExpression(argument),
    );
    if (callback == null || containsAssertion(callback.body, localFunctions, assertionIdentifiers)) {
      return;
    }
    const title = readTestTitle(node.arguments[0]);
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    findings.push({
      file,
      line: line + 1,
      title,
    });
  }
}

function isTestInvocation(node) {
  const callee = node.expression;
  if (ts.isIdentifier(callee)) {
    return callee.text === "test" || callee.text === "it";
  }
  if (!ts.isPropertyAccessExpression(callee)) {
    return false;
  }
  if (!ts.isIdentifier(callee.expression)) {
    return false;
  }
  if (callee.expression.text !== "test" && callee.expression.text !== "it") {
    return false;
  }
  return !TEST_HOOK_METHODS.has(callee.name.text);
}

function isWrappedTestInvocation(node, localTestWrappers) {
  const callee = node.expression;
  if (!ts.isIdentifier(callee) || !localTestWrappers.has(callee.text)) {
    return false;
  }
  return node.arguments.some((argument) => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument));
}

function isWrappedInnerTestInvocation(node, localTestWrappers) {
  return [...localTestWrappers.values()].some((wrapper) => node.getStart() >= wrapper.start && node.getEnd() <= wrapper.end);
}

function containsAssertion(node, localFunctions, assertionIdentifiers, visitedHelpers = new Set()) {
  let found = false;
  visit(node);
  return found;

  function visit(current) {
    if (found) {
      return;
    }
    if (ts.isThrowStatement(current)) {
      found = true;
      return;
    }
    if (ts.isCallExpression(current) && isAssertionCall(current, assertionIdentifiers)) {
      found = true;
      return;
    }
    if (ts.isCallExpression(current) && invokesAssertionHelper(current, localFunctions, assertionIdentifiers, visitedHelpers)) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  }
}

function isAssertionCall(node, assertionIdentifiers) {
  const callee = node.expression;
  if (ts.isIdentifier(callee)) {
    return ASSERTION_CALLEES.has(callee.text)
      || assertionIdentifiers.has(callee.text)
      || callee.text.startsWith("assert");
  }
  if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
    return ASSERTION_CALLEES.has(callee.expression.text)
      || assertionIdentifiers.has(callee.expression.text)
      || callee.name.text.startsWith("assert")
      || callee.name.text.startsWith("expect");
  }
  return false;
}

function invokesAssertionHelper(node, localFunctions, assertionIdentifiers, visitedHelpers) {
  const callee = node.expression;
  if (!ts.isIdentifier(callee)) {
    return false;
  }
  const declaration = localFunctions.get(callee.text);
  if (declaration == null || visitedHelpers.has(callee.text)) {
    return false;
  }
  visitedHelpers.add(callee.text);
  const contains = containsAssertion(declaration, localFunctions, assertionIdentifiers, visitedHelpers);
  visitedHelpers.delete(callee.text);
  return contains;
}

function buildLocalFunctionMap(sourceFile) {
  const localFunctions = new Map();
  visit(sourceFile);
  return localFunctions;

  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name != null && node.body != null) {
      localFunctions.set(node.name.text, node.body);
    } else if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || declaration.initializer == null) {
          continue;
        }
        if (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer)) {
          localFunctions.set(declaration.name.text, declaration.initializer.body);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
}

function buildLocalTestWrapperMap(sourceFile) {
  const wrappers = new Map();
  visit(sourceFile);
  return wrappers;

  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name != null && node.body != null) {
      if (containsNestedTestInvocation(node.body)) {
        wrappers.set(node.name.text, { start: node.body.getStart(sourceFile), end: node.body.getEnd() });
      }
    } else if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || declaration.initializer == null) {
          continue;
        }
        if (!ts.isArrowFunction(declaration.initializer) && !ts.isFunctionExpression(declaration.initializer)) {
          continue;
        }
        if (containsNestedTestInvocation(declaration.initializer.body)) {
          wrappers.set(declaration.name.text, {
            start: declaration.initializer.body.getStart(sourceFile),
            end: declaration.initializer.body.getEnd(),
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
}

function buildAssertionIdentifierSet(sourceFile) {
  const identifiers = new Set(ASSERTION_CALLEES);
  visit(sourceFile);
  return identifiers;

  function visit(node) {
    if (ts.isImportDeclaration(node)
      && ts.isStringLiteral(node.moduleSpecifier)
      && ASSERTION_MODULE_PATTERNS.includes(node.moduleSpecifier.text)
      && node.importClause != null
    ) {
      const { name, namedBindings } = node.importClause;
      if (name != null) {
        identifiers.add(name.text);
      }
      if (namedBindings != null && ts.isNamedImports(namedBindings)) {
        for (const element of namedBindings.elements) {
          identifiers.add(element.name.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
}

function containsNestedTestInvocation(node) {
  let found = false;
  visit(node);
  return found;

  function visit(current) {
    if (found) {
      return;
    }
    if (ts.isCallExpression(current) && isTestInvocation(current)) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  }
}

function readTestTitle(node) {
  if (node == null) {
    return "<anonymous>";
  }
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return "<dynamic>";
}

function inferScriptKind(file) {
  return file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}
