/**
 * Unit Test: Documentation Link and Structure Validation
 *
 * Verifies that the new formal documentation structure under docs_zh/
 * is present and internally linked.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, extname, dirname } from "node:path";

const DOC_ROOT = join(process.cwd(), "docs_zh");

test("documentation: docs_zh directory has required structure", async () => {
  const requiredDirs = [
    "architecture",
    "migration",
    "quality",
    "analysis",
    "contracts",
    "operations",
    "adr",
    "governance",
    "guides",
  ];

  for (const dir of requiredDirs) {
    const dirPath = join(DOC_ROOT, dir);
    try {
      const entries = await readdir(dirPath);
      assert.ok(entries.length > 0, `Documentation directory ${dir} should not be empty`);
    } catch {
      assert.fail(`Required documentation directory ${dir} does not exist at ${dirPath}`);
    }
  }
});

test("documentation: docs_zh root keeps required entry documents", async () => {
  const requiredFiles = [
    "README.md",
    "architecture/00-platform-architecture.md",
    "architecture/01-code-structure.md",
    "architecture/02-code-architecture-reference.md",
    "architecture/04-runtime-sequence.md",
    "migration/00-migration-guideline.md",
    "migration/01-migration-scope.md",
    "quality/00-full-coverage-test-manual.md",
    "quality/01-release-checklist.md",
    "analysis/00-architecture-coverage-matrix.md",
  ];

  for (const file of requiredFiles) {
    const filePath = join(DOC_ROOT, file);
    try {
      await readFile(filePath, "utf-8");
    } catch {
      assert.fail(`Required documentation file ${file} does not exist at ${filePath}`);
    }
  }
});

test("documentation: markdown files in docs_zh have valid internal links", async () => {
  const mdFiles = await getMarkdownFiles(DOC_ROOT);

  let totalLinksChecked = 0;
  let totalLinksValid = 0;

  for (const mdFile of mdFiles) {
    const content = await readFile(mdFile, "utf-8");
    const links = extractMarkdownLinks(content);

    for (const link of links) {
      if (link.startsWith("http://") || link.startsWith("https://")) {
        continue;
      }

      if (link.startsWith("#")) {
        continue;
      }

      totalLinksChecked++;
      // Strip anchor from link (e.g., "file.md:1" -> "file.md")
      const linkWithoutAnchor = link.replace(/:(\d+)$/, "");
      const linkPath = linkWithoutAnchor.startsWith("/") ? linkWithoutAnchor : join(dirname(mdFile), linkWithoutAnchor);

      try {
        const fileStat = await stat(linkPath);
        if (fileStat.isDirectory()) {
          totalLinksValid++;
        } else {
          await readFile(linkPath, "utf-8");
          totalLinksValid++;
        }
      } catch {
        assert.fail(`Link ${link} in ${mdFile} does not exist at ${linkPath}`);
      }
    }
  }

  assert.ok(totalLinksChecked > 0, "Should have checked some links");
  assert.equal(totalLinksValid, totalLinksChecked, `All ${totalLinksChecked} links should be valid`);
});

test("documentation: docs_zh/contracts contains contract files", async () => {
  const contractsDir = join(DOC_ROOT, "contracts");

  try {
    const files = await readdir(contractsDir);
    assert.ok(files.length > 0, "contracts directory should not be empty");
  } catch {
    assert.fail("contracts directory does not exist");
  }
});

test("documentation: docs_zh/operations contains operational documents", async () => {
  const operationsDir = join(DOC_ROOT, "operations");

  try {
    const files = await readdir(operationsDir);
    assert.ok(files.length > 0, "operations directory should not be empty");
  } catch {
    assert.fail("operations directory does not exist");
  }
});

test("documentation: ADR index lists existing files", async () => {
  const adrReadmePath = join(DOC_ROOT, "adr", "README.md");
  const adrContent = await readFile(adrReadmePath, "utf-8");
  const adrLinks = extractMarkdownLinks(adrContent).filter((link) => link.includes("./"));

  let checked = 0;
  for (const link of adrLinks) {
    const adrPath = join(dirname(adrReadmePath), link);
    try {
      await readFile(adrPath, "utf-8");
      checked++;
    } catch {
      assert.fail(`ADR index lists ${link} but file does not exist`);
    }
  }

  assert.ok(checked > 0, "Should have checked some ADR files");
});

async function getMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await getMarkdownFiles(fullPath));
    } else if (entry.isFile() && extname(entry.name) === ".md") {
      files.push(fullPath);
    }
  }

  return files;
}

function extractMarkdownLinks(content: string): string[] {
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links: string[] = [];
  let match;

  while ((match = linkPattern.exec(content)) !== null) {
    links.push(match[2]!);
  }

  return links;
}
