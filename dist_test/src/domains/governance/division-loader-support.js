import { join } from "node:path";
import { SandboxError, ValidationError, WorkflowStateError } from "../../platform/contracts/errors.js";
export function throwDivisionValidationError(code, details = {}) {
    throw new ValidationError(code, code, {
        retryable: false,
        details,
    });
}
export function throwDivisionWorkflowError(code, details = {}) {
    throw new WorkflowStateError(code, code, {
        retryable: false,
        details,
    });
}
export function throwDivisionSandboxError(code, details = {}) {
    throw new SandboxError(code, code, {
        retryable: false,
        details,
    });
}
export const DEFAULT_DIVISIONS_ROOT = join(process.cwd(), "divisions");
export function tokenizeYaml(raw) {
    return raw
        .split(/\r?\n/)
        .map((line, index) => ({ rawLine: line, lineNumber: index + 1 }))
        .filter(({ rawLine }) => rawLine.trim().length > 0 && !rawLine.trimStart().startsWith("#"))
        .map(({ rawLine, lineNumber }) => ({
        indent: rawLine.match(/^ */)?.[0].length ?? 0,
        text: rawLine.trim(),
        lineNumber,
    }));
}
export function parseLimitedYaml(raw, sourcePath) {
    const lines = tokenizeYaml(raw);
    if (lines.length === 0)
        return {};
    const [value, nextIndex] = parseBlock(lines, 0, lines[0].indent, sourcePath);
    if (nextIndex !== lines.length) {
        throwDivisionValidationError("yaml.trailing_content", {
            sourcePath,
            lineNumber: lines[nextIndex].lineNumber,
        });
    }
    return value;
}
export function parseBlock(lines, startIndex, indent, sourcePath) {
    const line = lines[startIndex];
    if (!line || line.indent < indent)
        return [{}, startIndex];
    if (line.indent !== indent) {
        throwDivisionValidationError("yaml.invalid_indent", { sourcePath, lineNumber: line.lineNumber });
    }
    return line.text.startsWith("- ")
        ? parseArray(lines, startIndex, indent, sourcePath)
        : parseObject(lines, startIndex, indent, sourcePath);
}
export function parseObject(lines, startIndex, indent, sourcePath) {
    const result = {};
    let index = startIndex;
    while (index < lines.length) {
        const line = lines[index];
        if (!line)
            break;
        if (line.indent < indent)
            break;
        if (line.indent > indent) {
            throwDivisionValidationError("yaml.invalid_indent", { sourcePath, lineNumber: line.lineNumber });
        }
        if (line.text.startsWith("- "))
            break;
        const [key, inlineValue] = splitKeyValue(line.text, sourcePath, line.lineNumber);
        index += 1;
        if (inlineValue.length > 0) {
            result[key] = parseScalar(inlineValue);
            continue;
        }
        if (index < lines.length && (lines[index]?.indent ?? -1) > indent) {
            const [nestedValue, nextIndex] = parseBlock(lines, index, indent + 2, sourcePath);
            result[key] = nestedValue;
            index = nextIndex;
            continue;
        }
        result[key] = null;
    }
    return [result, index];
}
export function parseArray(lines, startIndex, indent, sourcePath) {
    const result = [];
    let index = startIndex;
    while (index < lines.length) {
        const line = lines[index];
        if (!line)
            break;
        if (line.indent < indent)
            break;
        if (line.indent > indent) {
            throwDivisionValidationError("yaml.invalid_indent", { sourcePath, lineNumber: line.lineNumber });
        }
        if (!line.text.startsWith("- "))
            break;
        const itemText = line.text.slice(2).trim();
        index += 1;
        if (itemText.length === 0) {
            if (index >= lines.length || (lines[index]?.indent ?? -1) <= indent) {
                result.push(null);
                continue;
            }
            const [nestedValue, nextIndex] = parseBlock(lines, index, indent + 2, sourcePath);
            result.push(nestedValue);
            index = nextIndex;
            continue;
        }
        if (looksLikeKeyValue(itemText)) {
            const [key, inlineValue] = splitKeyValue(itemText, sourcePath, line.lineNumber);
            const objectValue = { [key]: inlineValue.length > 0 ? parseScalar(inlineValue) : null };
            if (index < lines.length && (lines[index]?.indent ?? -1) > indent) {
                const [nestedValue, nextIndex] = parseObject(lines, index, indent + 2, sourcePath);
                Object.assign(objectValue, nestedValue);
                index = nextIndex;
            }
            result.push(objectValue);
            continue;
        }
        result.push(parseScalar(itemText));
    }
    return [result, index];
}
export function splitKeyValue(text, sourcePath, lineNumber) {
    const separatorIndex = text.indexOf(":");
    if (separatorIndex <= 0) {
        throwDivisionValidationError("yaml.invalid_mapping", { sourcePath, lineNumber });
    }
    const key = text.slice(0, separatorIndex).trim();
    const value = text.slice(separatorIndex + 1).trim();
    if (key.length === 0) {
        throwDivisionValidationError("yaml.invalid_mapping", { sourcePath, lineNumber });
    }
    return [key, value];
}
export function looksLikeKeyValue(text) {
    return text.includes(":");
}
export function parseScalar(raw) {
    if (raw === "true")
        return true;
    if (raw === "false")
        return false;
    if (raw === "null")
        return null;
    if (raw.startsWith("[") && raw.endsWith("]")) {
        const inner = raw.slice(1, -1).trim();
        if (inner.length === 0)
            return [];
        return inner.split(",").map((item) => parseScalar(item.trim()));
    }
    if (/^-?\d+$/.test(raw))
        return Number(raw);
    if ((raw.startsWith("\"") && raw.endsWith("\"")) || (raw.startsWith("'") && raw.endsWith("'"))) {
        return raw.slice(1, -1);
    }
    return raw;
}
export function isPlainObject(value) {
    return value != null && typeof value === "object" && !Array.isArray(value);
}
export function expectNonEmptyString(value, errorCode) {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new ValidationError(errorCode, errorCode, { retryable: false });
    }
    return value.trim();
}
export function toObjectArray(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((entry) => isPlainObject(entry));
}
export function toStringArray(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .filter((entry) => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}
export function toInteger(value, fallback) {
    if (typeof value === "number" && Number.isInteger(value))
        return value;
    if (typeof value === "string" && /^-?\d+$/.test(value.trim()))
        return Number(value.trim());
    return fallback;
}
//# sourceMappingURL=division-loader-support.js.map