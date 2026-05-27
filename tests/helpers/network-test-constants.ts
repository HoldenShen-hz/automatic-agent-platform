export const LOOPBACK_HOST = "127.0.0.1";
export const LOOPBACK_BASE_URL = `http://${LOOPBACK_HOST}`;

export const OAUTH_CALLBACK_PORT = 8787;
export const OAUTH_CALLBACK_URL = `${LOOPBACK_BASE_URL}:${OAUTH_CALLBACK_PORT}/callback`;

export const OTEL_TEST_PORT = 4318;
export const OTEL_TEST_ENDPOINT = `${LOOPBACK_BASE_URL}:${OTEL_TEST_PORT}`;

export const API_SERVER_TEST_PORT = 8080;
export const API_SERVER_TEST_BASE_URL = `${LOOPBACK_BASE_URL}:${API_SERVER_TEST_PORT}`;

export const UNREACHABLE_LOOPBACK_PORT = 9999;
export const UNREACHABLE_LOOPBACK_BASE_URL = `${LOOPBACK_BASE_URL}:${UNREACHABLE_LOOPBACK_PORT}`;

export const TEST_POSTGRES_DSN = "postgresql://user:test-password@127.0.0.1:5432/testdb";

export function buildLoopbackUrl(port: number, path: string): string {
  return `${LOOPBACK_BASE_URL}:${port}${path}`;
}
