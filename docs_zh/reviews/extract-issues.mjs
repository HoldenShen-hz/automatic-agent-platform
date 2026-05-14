import { readFileSync } from 'fs';

const content = readFileSync('/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_zh/reviews/architecture-design-review.md', 'utf-8');

const lines = content.split('\n');

const issues = [];
let currentIssue = null;
let inIssue = false;
let currentField = null; // 'filePath' | 'description' | 'fix'
let currentValue = '';

function flushField(issue, field, value) {
  if (field === 'filePath') issue.filePath = value.trim();
  else if (field === 'description') issue.description = value.trim();
  else if (field === 'fix') issue.fix = value.trim();
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Issue header pattern: #### N. [区域] [严重度] [标题]
  const headerMatch = line.match(/^#### (\d+)\. \[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\]/);

  if (headerMatch) {
    // Save previous issue if exists
    if (currentIssue && currentField) {
      flushField(currentIssue, currentField, currentValue);
      issues.push(currentIssue);
    }

    // Start new issue
    currentIssue = {
      originalId: parseInt(headerMatch[1]),
      area: headerMatch[2],
      severity: headerMatch[3],
      title: headerMatch[4],
      filePath: '',
      description: '',
      fix: ''
    };
    inIssue = true;
    currentField = null;
    currentValue = '';
    continue;
  }

  if (inIssue && currentIssue) {
    // Check for field markers with various patterns
    // Pattern 1: "- **文件/路径**: value" or "- **文件/路径**:"
    let fieldMatch = line.match(/^-\s+\*\*文件\/路径\*\*:\s*(.*)/);
    if (fieldMatch) {
      if (currentField) flushField(currentIssue, currentField, currentValue);
      currentField = 'filePath';
      currentValue = fieldMatch[1];
      continue;
    }

    // Pattern 2: "**文件/路径**: value" or "**文件/路径**:"
    fieldMatch = line.match(/^\*\*文件\/路径\*\*:\s*(.*)/);
    if (fieldMatch) {
      if (currentField) flushField(currentIssue, currentField, currentValue);
      currentField = 'filePath';
      currentValue = fieldMatch[1];
      continue;
    }

    // Pattern 3: "- **问题描述**: value"
    fieldMatch = line.match(/^-\s+\*\*问题描述\*\*:\s*(.*)/);
    if (fieldMatch) {
      if (currentField) flushField(currentIssue, currentField, currentValue);
      currentField = 'description';
      currentValue = fieldMatch[1];
      continue;
    }

    // Pattern 4: "**问题描述**: value"
    fieldMatch = line.match(/^\*\*问题描述\*\*:\s*(.*)/);
    if (fieldMatch) {
      if (currentField) flushField(currentIssue, currentField, currentValue);
      currentField = 'description';
      currentValue = fieldMatch[1];
      continue;
    }

    // Pattern 5: "- **建议修复**: value"
    fieldMatch = line.match(/^-\s+\*\*建议修复\*\*:\s*(.*)/);
    if (fieldMatch) {
      if (currentField) flushField(currentIssue, currentField, currentValue);
      currentField = 'fix';
      currentValue = fieldMatch[1];
      continue;
    }

    // Pattern 6: "**建议修复**: value"
    fieldMatch = line.match(/^\*\*建议修复\*\*:\s*(.*)/);
    if (fieldMatch) {
      if (currentField) flushField(currentIssue, currentField, currentValue);
      currentField = 'fix';
      currentValue = fieldMatch[1];
      continue;
    }

    // Continuation lines for filePath (lines like "  - `path`" or "  - path")
    if (currentField === 'filePath' && line.match(/^\s+-\s+/)) {
      // Check if it's a backtick path: "  - `path`"
      const pathMatch = line.match(/^\s+-\s+`(.*?)`/);
      if (pathMatch) {
        currentValue += '\n' + pathMatch[1];
        continue;
      }
      // Otherwise it's a continuation of description, not filePath
      // Fall through
    }

    // Continuation lines for description or fix (indented lines with list markers)
    if (line.match(/^\s+/) && (currentField === 'description' || currentField === 'fix')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') || trimmed.match(/^\d+\./) || trimmed.match(/^[a-z]\)\s/)) {
        const clean = trimmed.replace(/^-\s*/, '').replace(/^\d+\.\s*/, '').replace(/^[a-z]\)\s*/, '');
        currentValue += ' ' + clean;
        continue;
      }
    }
  }
}

// Don't forget the last issue
if (currentIssue) {
  if (currentField) flushField(currentIssue, currentField, currentValue);
  issues.push(currentIssue);
}

console.log(`Total issues extracted: ${issues.length}`);

// Now deduplicate based on: area + severity + title + filePath (normalized)
const seen = new Map();
const deduped = [];

for (const issue of issues) {
  // Normalize file path for comparison - take first path and normalize
  const firstPath = issue.filePath.split('\n')[0].toLowerCase().replace(/\s+/g, ' ').trim();
  const key = `${issue.area}|${issue.severity}|${issue.title}|${firstPath}`;

  if (!seen.has(key)) {
    seen.set(key, true);
    deduped.push(issue);
  }
}

console.log(`After deduplication: ${deduped.length}`);

// Output as markdown table
console.log('\n| ID | 区域 | 严重度 | 问题 | 文件路径 | 状态 |');
console.log('|---|---|---|---|---|---|');

for (let i = 0; i < deduped.length; i++) {
  const issue = deduped[i];
  const id = i + 1;
  const title = issue.title.replace(/\|/g, '\\|');
  // Take first file path (before newline)
  let filePath = issue.filePath.split('\n')[0].replace(/\|/g, '\\|');
  if (filePath.length > 80) {
    filePath = filePath.substring(0, 77) + '...';
  }
  console.log(`| ${id} | ${issue.area} | ${issue.severity} | ${title} | ${filePath} | 未处理 |`);
}