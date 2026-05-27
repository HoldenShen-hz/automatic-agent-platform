import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const reviewPath = join(currentDir, "..", "..", "docs_zh", "reviews", "architecture-design-review.md");
const content = readFileSync(reviewPath, "utf-8");

const lines = content.split("\n");

const issues = [];
let currentIssue = null;
let inIssue = false;
let currentField = null;
let currentValue = "";

function flushField(issue, field, value) {
  if (field === "filePath") {
    issue.filePath = value.trim();
  } else if (field === "description") {
    issue.description = value.trim();
  } else if (field === "fix") {
    issue.fix = value.trim();
  }
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const headerMatch = line.match(/^#### (\d+)\. \[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\]/);

  if (headerMatch) {
    if (currentIssue && currentField) {
      flushField(currentIssue, currentField, currentValue);
      issues.push(currentIssue);
    }

    currentIssue = {
      originalId: Number.parseInt(headerMatch[1], 10),
      area: headerMatch[2],
      severity: headerMatch[3],
      title: headerMatch[4],
      filePath: "",
      description: "",
      fix: "",
    };
    inIssue = true;
    currentField = null;
    currentValue = "";
    continue;
  }

  if (!inIssue || currentIssue == null) {
    continue;
  }

  let fieldMatch = line.match(/^-\s+\*\*文件\/路径\*\*:\s*(.*)/);
  if (fieldMatch) {
    if (currentField) {
      flushField(currentIssue, currentField, currentValue);
    }
    currentField = "filePath";
    currentValue = fieldMatch[1];
    continue;
  }

  fieldMatch = line.match(/^\*\*文件\/路径\*\*:\s*(.*)/);
  if (fieldMatch) {
    if (currentField) {
      flushField(currentIssue, currentField, currentValue);
    }
    currentField = "filePath";
    currentValue = fieldMatch[1];
    continue;
  }

  fieldMatch = line.match(/^-\s+\*\*问题描述\*\*:\s*(.*)/);
  if (fieldMatch) {
    if (currentField) {
      flushField(currentIssue, currentField, currentValue);
    }
    currentField = "description";
    currentValue = fieldMatch[1];
    continue;
  }

  fieldMatch = line.match(/^-\s+\*\*修复建议\*\*:\s*(.*)/);
  if (fieldMatch) {
    if (currentField) {
      flushField(currentIssue, currentField, currentValue);
    }
    currentField = "fix";
    currentValue = fieldMatch[1];
    continue;
  }

  if (currentField && line.trim().length > 0) {
    currentValue += ` ${line.trim()}`;
  }
}

if (currentIssue && currentField) {
  flushField(currentIssue, currentField, currentValue);
  issues.push(currentIssue);
}

const output = issues.map((issue) => ({
  id: issue.originalId,
  area: issue.area,
  severity: issue.severity,
  title: issue.title,
  filePath: issue.filePath,
  description: issue.description,
  fix: issue.fix,
}));

console.log(JSON.stringify(output, null, 2));
