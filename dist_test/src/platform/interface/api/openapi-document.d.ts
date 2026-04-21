export interface ApiRouteSpec {
    method: "GET" | "POST";
    path: string;
    summary: string;
    tags: string[];
}
export declare function buildOpenApiDocument(): {
    openapi: string;
    info: {
        title: string;
        version: string;
    };
    paths: Record<string, Record<string, unknown>>;
};
export declare function listApiRoutes(): ApiRouteSpec[];
