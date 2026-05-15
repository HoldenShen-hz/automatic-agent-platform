import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DOC_ROOT = join(process.cwd(), "docs_zh");
const ARCH_ROOT = join(DOC_ROOT, "architecture");
const CONTRACTS_ROOT = join(DOC_ROOT, "contracts");
const REVIEWS_ROOT = join(DOC_ROOT, "reviews");

test("architecture documents are internally consistent with each other", () => {
  const archReadme = readFileSync(join(ARCH_ROOT, "README.md"), "utf8");

  const sectionLinks = Array.from(archReadme.matchAll(/\(([^)]+\.md)\)/g))
    .map((m) => m[1]!)
    .filter((l) => !l.startsWith("http") && !l.startsWith("#"));

  for (const link of sectionLinks) {
    const resolved = join(ARCH_ROOT, link);
    assert.ok(
      existsSync(resolved),
      `architecture README references non-existent file: ${link}`,
    );
  }
});

test("contract documents reference real architectural sections", () => {
  const contractFiles = readdirSync(CONTRACTS_ROOT).filter((f) => f.endsWith(".md"));
  assert.ok(contractFiles.length > 0, "no contract documents found");

  const archFile = readFileSync(join(ARCH_ROOT, "00-platform-architecture.md"), "utf8");
  const archSections = Array.from(archFile.matchAll(/^##?\s+(.+)$/gm)).map((m) => m[1]).filter((s): s is string => s !== undefined);

  let contractsReferencingArch = 0;

  for (const contractFile of contractFiles) {
    const content = readFileSync(join(CONTRACTS_ROOT, contractFile), "utf8");
    const hasArchRef = archSections.some((section) => content.includes(section));
    if (hasArchRef) {
      contractsReferencingArch++;
    }
  }

  assert.ok(
    contractsReferencingArch > 0,
    "no contract documents reference architectural sections",
  );
});

test("review documents reference existing contract files", () => {
  if (!existsSync(REVIEWS_ROOT)) return;

  const reviewFiles = readdirSync(REVIEWS_ROOT).filter((f) => f.endsWith(".md"));

  for (const reviewFile of reviewFiles) {
    const content = readFileSync(join(REVIEWS_ROOT, reviewFile), "utf8");
    const contractRefs = Array.from(content.matchAll(/contracts\/([^`\s)]+\.md)/g))
      .map((m) => m[1])
      .filter((r): r is string => r !== undefined);

    for (const contractRef of contractRefs) {
      const resolved = join(CONTRACTS_ROOT, contractRef);
      assert.ok(
        existsSync(resolved),
        `${reviewFile} references non-existent contract: ${contractRef}`,
      );
    }
  }
});

test("all contract documents have non-empty content with expected structure", () => {
  const contractFiles = readdirSync(CONTRACTS_ROOT).filter((f) => f.endsWith(".md"));

  for (const contractFile of contractFiles) {
    const content = readFileSync(join(CONTRACTS_ROOT, contractFile), "utf8");

    assert.ok(content.length > 200, `${contractFile} is suspiciously short`);

    const hasSections = /^#{1,3}\s+/m.test(content);
    assert.ok(hasSections, `${contractFile} lacks section headers`);

    const hasInterfaceOrContract = /interface|contract|type|schema|api/i.test(content);
    assert.ok(hasInterfaceOrContract, `${contractFile} lacks interface/contract markers`);
  }
});

test("architecture README contains a table of contents with all major sections", () => {
  const readmePath = join(ARCH_ROOT, "README.md");
  const content = readFileSync(readmePath, "utf8");

  const expectedSections = [
    "00-platform-architecture",
    "01-code-structure",
  ];

  for (const section of expectedSections) {
    assert.match(
      content,
      new RegExp(section),
      `architecture README missing reference to ${section}`,
    );
  }
});
