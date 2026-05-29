export function createGeneratedBinding(id, source) {
    return {
        id,
        source,
        generatedAt: new Date().toISOString(),
    };
}
export function generateEndpointBindingModule(endpoints) {
    return endpoints
        .map((endpoint) => `export const ${endpoint.id}Path = ${jsonLiteral(endpoint.path)};`)
        .join("\n");
}
function toConstantName(input) {
    return input
        .replace(/[^a-zA-Z0-9]+(.)/g, (_match, group) => group.toUpperCase())
        .replace(/^[A-Z]/, (value) => value.toLowerCase());
}
function toTypeName(input) {
    const sanitized = input
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .trim();
    if (sanitized.length === 0) {
        return "GeneratedType";
    }
    return sanitized
        .split(/\s+/)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join("")
        .replace(/^[0-9]/, (digit) => `Type${digit}`);
}
function sortedEntries(record) {
    return Object.entries(record ?? {}).sort(([left], [right]) => left.localeCompare(right));
}
function isIdentifierName(value) {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);
}
function toPropertyName(propertyName) {
    return isIdentifierName(propertyName) ? propertyName : jsonLiteral(propertyName);
}
function createOperationKey(method, path) {
    return `${method.toUpperCase()} ${path}`;
}
function createOperationSuffix(method, path) {
    let hash = 0;
    const input = createOperationKey(method, path);
    for (let index = 0; index < input.length; index += 1) {
        hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
    }
    return hash.toString(36).padStart(6, "0");
}
function resolveRefName(ref) {
    return toTypeName(ref.split("/").pop() ?? "GeneratedType");
}
function jsonLiteral(value) {
    return JSON.stringify(value);
}
function normalizeSchemaArray(value) {
    return value ?? [];
}
function appendSchemaDeclaration(name, schema, declarations) {
    const declaration = buildSchemaDeclaration(name, schema, declarations);
    if (declaration != null) {
        declarations.push(declaration);
    }
}
function buildSchemaDeclaration(name, schema, declarations) {
    if (schema.$ref != null) {
        return `export type ${name} = ${resolveRefName(schema.$ref)};`;
    }
    if (isInterfaceLikeSchema(schema)) {
        const members = buildObjectMembers(schema, declarations);
        return `export interface ${name} {\n${members.length === 0 ? "  [key: string]: unknown;" : members.join("\n")}\n}`;
    }
    return `export type ${name} = ${schemaToType(schema, declarations)};`;
}
function isInterfaceLikeSchema(schema) {
    if (schema.oneOf != null || schema.anyOf != null || schema.allOf != null) {
        return false;
    }
    if (schema.enum != null) {
        return false;
    }
    if (schema.$ref != null) {
        return false;
    }
    return schema.type === "object"
        || schema.properties != null
        || typeof schema.additionalProperties === "object";
}
function buildObjectMembers(schema, declarations) {
    const required = new Set(schema.required ?? []);
    const members = sortedEntries(schema.properties).map(([propertyName, propertySchema]) => {
        const optionalMarker = required.has(propertyName) ? "" : "?";
        return `  ${toPropertyName(propertyName)}${optionalMarker}: ${schemaToType(propertySchema, declarations)};`;
    });
    if (typeof schema.additionalProperties === "object") {
        members.push(`  [key: string]: ${schemaToType(schema.additionalProperties, declarations)};`);
    }
    else if (schema.additionalProperties === true && members.length === 0) {
        members.push("  [key: string]: unknown;");
    }
    return members;
}
function schemaToType(schema, declarations) {
    if (schema.$ref != null) {
        return resolveRefName(schema.$ref);
    }
    if (schema.enum != null && schema.enum.length > 0) {
        return schema.enum.map((value) => jsonLiteral(value)).join(" | ");
    }
    const baseObjectMembers = buildObjectMembers(schema, declarations);
    const baseObjectType = baseObjectMembers.length > 0 ? `{\n${baseObjectMembers.join("\n")}\n}` : null;
    if (schema.oneOf != null && schema.oneOf.length > 0) {
        const variants = normalizeSchemaArray(schema.oneOf).map((item) => schemaToType(item, declarations)).join(" | ");
        return baseObjectType == null ? variants : `${baseObjectType} & (${variants})`;
    }
    if (schema.anyOf != null && schema.anyOf.length > 0) {
        const variants = normalizeSchemaArray(schema.anyOf).map((item) => schemaToType(item, declarations)).join(" | ");
        return baseObjectType == null ? variants : `${baseObjectType} & (${variants})`;
    }
    if (schema.allOf != null && schema.allOf.length > 0) {
        const variants = normalizeSchemaArray(schema.allOf).map((item) => schemaToType(item, declarations)).join(" & ");
        return baseObjectType == null ? variants : `${baseObjectType} & ${variants}`;
    }
    const rawType = Array.isArray(schema.type) ? schema.type : schema.type == null ? [] : [schema.type];
    const nullableTypes = schema.nullable === true ? [...rawType, "null"] : rawType;
    if (nullableTypes.length > 1) {
        return nullableTypes.map((item) => schemaToType({ ...schema, nullable: false, type: item }, declarations)).join(" | ");
    }
    const resolvedType = nullableTypes[0];
    switch (resolvedType) {
        case "string":
            return "string";
        case "number":
        case "integer":
            return "number";
        case "boolean":
            return "boolean";
        case "null":
            return "null";
        case "array": {
            const itemType = schema.items == null ? "unknown" : schemaToType(schema.items, declarations);
            return itemType.includes(" | ") ? `(${itemType})[]` : `${itemType}[]`;
        }
        case "object":
        default: {
            if (schema.properties == null && typeof schema.additionalProperties === "object") {
                return `Record<string, ${schemaToType(schema.additionalProperties, declarations)}>`;
            }
            if (schema.properties == null && schema.additionalProperties === true) {
                return "Record<string, unknown>";
            }
            if (baseObjectMembers.length === 0) {
                return "Record<string, unknown>";
            }
            return baseObjectType ?? "Record<string, unknown>";
        }
    }
}
function pickSchemaFromContent(content) {
    if (content == null) {
        return null;
    }
    for (const mediaType of Object.values(content)) {
        if (mediaType.schema != null) {
            return mediaType.schema;
        }
    }
    return null;
}
function pickPrimaryResponseSchema(operation) {
    const responses = operation.responses ?? {};
    for (const candidate of ["200", "201", "202", "default"]) {
        const schema = pickSchemaFromContent(responses[candidate]?.content);
        if (schema != null) {
            return schema;
        }
    }
    for (const [statusCode, response] of Object.entries(responses)) {
        if (statusCode.startsWith("2")) {
            const schema = pickSchemaFromContent(response.content);
            if (schema != null) {
                return schema;
            }
        }
    }
    for (const response of Object.values(responses)) {
        const schema = pickSchemaFromContent(response.content);
        if (schema != null) {
            return schema;
        }
    }
    return null;
}
export function parseOpenApiDocument(document) {
    if (typeof document === "string") {
        return JSON.parse(document);
    }
    return document;
}
export function generateBindingsFromOpenApi(document) {
    const openApiDocument = parseOpenApiDocument(document);
    const endpointDeclarations = [];
    const schemaDeclarations = [];
    const operationTypeDeclarations = [];
    const usedOperationNames = new Map();
    for (const [schemaName, schema] of sortedEntries(openApiDocument.components?.schemas)) {
        appendSchemaDeclaration(toTypeName(schemaName), schema, schemaDeclarations);
    }
    for (const [path, methods] of sortedEntries(openApiDocument.paths)) {
        for (const [method, operation] of sortedEntries(methods)) {
            const operationId = operation.operationId ?? `${method}-${path}`;
            const operationKey = createOperationKey(method, path);
            const baseOperationName = toTypeName(operationId);
            const duplicateOwner = usedOperationNames.get(baseOperationName);
            const operationName = duplicateOwner == null || duplicateOwner === operationKey
                ? baseOperationName
                : `${baseOperationName}${createOperationSuffix(method, path)}`;
            usedOperationNames.set(operationName, operationKey);
            const endpointId = `${toConstantName(operationId)}Path`;
            endpointDeclarations.push(`export const ${endpointId} = { method: "${method.toUpperCase()}", path: ${jsonLiteral(path)} } as const;`);
            const requestSchema = pickSchemaFromContent(operation.requestBody?.content);
            if (requestSchema != null) {
                appendSchemaDeclaration(`${operationName}RequestBody`, requestSchema, operationTypeDeclarations);
            }
            const responseSchema = pickPrimaryResponseSchema(operation);
            if (responseSchema != null) {
                appendSchemaDeclaration(`${operationName}Response`, responseSchema, operationTypeDeclarations);
            }
        }
    }
    return [
        endpointDeclarations.join("\n"),
        schemaDeclarations.join("\n\n"),
        operationTypeDeclarations.join("\n\n"),
    ]
        .filter((section) => section.trim().length > 0)
        .join("\n\n");
}
