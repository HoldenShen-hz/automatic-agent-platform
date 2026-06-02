export const LOOPBACK_HOST = "127.0.0.1";
export const LOOPBACK_BASE_URL = `http://${LOOPBACK_HOST}`;
export const TEST_POSTGRES_USER = "test_user";
export const TEST_POSTGRES_PASSWORD = "test-password-placeholder";
export const TEST_POSTGRES_DATABASE = "testdb";
export const TEST_POSTGRES_PORT = readPort("AA_TEST_POSTGRES_PORT", 5432);

export const OAUTH_CALLBACK_PORT = readPort("AA_TEST_OAUTH_CALLBACK_PORT", 8787);
export const OAUTH_CALLBACK_URL = `${LOOPBACK_BASE_URL}:${OAUTH_CALLBACK_PORT}/callback`;

export const OTEL_TEST_PORT = readPort("AA_TEST_OTEL_PORT", 4318);
export const OTEL_TEST_ENDPOINT = `${LOOPBACK_BASE_URL}:${OTEL_TEST_PORT}`;

export const API_SERVER_TEST_PORT = readPort("AA_TEST_API_SERVER_PORT", 8080);
export const API_SERVER_TEST_BASE_URL = `${LOOPBACK_BASE_URL}:${API_SERVER_TEST_PORT}`;

export const UNREACHABLE_LOOPBACK_PORT = readPort("AA_TEST_UNREACHABLE_PORT", 9999);
export const UNREACHABLE_LOOPBACK_BASE_URL = `${LOOPBACK_BASE_URL}:${UNREACHABLE_LOOPBACK_PORT}`;

export const TEST_POSTGRES_DSN = buildTestPostgresDsn();

export interface TestPostgresDsnOverrides {
  readonly user?: string;
  readonly password?: string;
  readonly host?: string;
  readonly port?: number;
  readonly database?: string;
}

export function buildTestPostgresDsn(overrides: TestPostgresDsnOverrides = {}): string {
  const {
    user = TEST_POSTGRES_USER,
    password = TEST_POSTGRES_PASSWORD,
    host = LOOPBACK_HOST,
    port = TEST_POSTGRES_PORT,
    database = TEST_POSTGRES_DATABASE,
  } = overrides;
  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

export function buildLoopbackUrl(port: number, path: string): string {
  return `${LOOPBACK_BASE_URL}:${port}${path}`;
}

export async function getEphemeralPort(host = LOOPBACK_HOST): Promise<number> {
  const { createServer } = await import("node:net");
  const server = createServer();
  return await new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (address == null || typeof address === "string") {
        server.close(() => reject(new Error("ephemeral_port_unavailable")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

function readPort(envName: string, fallback: number): number {
  const raw = process.env[envName];
  if (raw == null || raw.trim().length === 0) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`${envName} must be a valid port, received: ${raw}`);
  }
  return parsed;
}
