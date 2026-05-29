export interface GeneratedBinding {
    readonly id: string;
    readonly source: string;
    readonly generatedAt: string;
}
export interface OpenApiSchema {
    readonly $ref?: string;
    readonly type?: string | readonly string[];
    readonly enum?: readonly unknown[];
    readonly properties?: Record<string, OpenApiSchema>;
    readonly required?: readonly string[];
    readonly items?: OpenApiSchema;
    readonly additionalProperties?: boolean | OpenApiSchema;
    readonly nullable?: boolean;
    readonly oneOf?: readonly OpenApiSchema[];
    readonly anyOf?: readonly OpenApiSchema[];
    readonly allOf?: readonly OpenApiSchema[];
}
export interface OpenApiMediaTypeObject {
    readonly schema?: OpenApiSchema;
}
export interface OpenApiRequestBodyObject {
    readonly content?: Record<string, OpenApiMediaTypeObject>;
}
export interface OpenApiResponseObject {
    readonly content?: Record<string, OpenApiMediaTypeObject>;
}
export interface OpenApiOperationObject {
    readonly operationId?: string;
    readonly requestBody?: OpenApiRequestBodyObject;
    readonly responses?: Record<string, OpenApiResponseObject>;
}
export interface OpenApiDocument {
    readonly paths: Record<string, Record<string, OpenApiOperationObject>>;
    readonly components?: {
        readonly schemas?: Record<string, OpenApiSchema>;
    };
}
export declare function createGeneratedBinding(id: string, source: string): GeneratedBinding;
export declare function generateEndpointBindingModule(endpoints: readonly {
    readonly id: string;
    readonly path: string;
}[]): string;
export declare function parseOpenApiDocument(document: string | OpenApiDocument): OpenApiDocument;
export declare function generateBindingsFromOpenApi(document: string | OpenApiDocument): string;
