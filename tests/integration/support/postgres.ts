import postgres, { type Sql } from "postgres";

const EXPECTED_TARGETS = {
  TEST_DEMO_APP_URL: {
    database: "project_desk_demo",
    username: "demo_app",
  },
  TEST_DEMO_MIGRATOR_URL: {
    database: "project_desk_demo",
    username: "demo_migrator",
  },
  TEST_POSTGRES_ADMIN_URL: {
    database: "postgres",
    username: "postgres",
  },
  TEST_PRIMARY_APP_URL: {
    database: "project_desk_primary",
    username: "primary_app",
  },
  TEST_PRIMARY_MIGRATOR_URL: {
    database: "project_desk_primary",
    username: "primary_migrator",
  },
} as const;

export type TestDatabaseEnvironmentKey = keyof typeof EXPECTED_TARGETS;

export interface TestDatabaseUrls {
  readonly admin: string;
  readonly demoApp: string;
  readonly demoMigrator: string;
  readonly primaryApp: string;
  readonly primaryMigrator: string;
}

function requireLoopbackTestUrl(key: TestDatabaseEnvironmentKey): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    throw new Error(`Integration test configuration is missing ${key}.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Integration test configuration is invalid for ${key}.`);
  }

  const expected = EXPECTED_TARGETS[key];
  const database = decodeURIComponent(parsed.pathname.slice(1));
  const isLoopback =
    parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (
    parsed.protocol !== "postgresql:" ||
    !isLoopback ||
    parsed.username !== expected.username ||
    database !== expected.database ||
    parsed.password === ""
  ) {
    throw new Error(`Integration test target is unsafe for ${key}.`);
  }

  return value;
}

export function loadTestDatabaseUrls(): TestDatabaseUrls {
  return Object.freeze({
    admin: requireLoopbackTestUrl("TEST_POSTGRES_ADMIN_URL"),
    demoApp: requireLoopbackTestUrl("TEST_DEMO_APP_URL"),
    demoMigrator: requireLoopbackTestUrl("TEST_DEMO_MIGRATOR_URL"),
    primaryApp: requireLoopbackTestUrl("TEST_PRIMARY_APP_URL"),
    primaryMigrator: requireLoopbackTestUrl("TEST_PRIMARY_MIGRATOR_URL"),
  });
}

export function createTestSql(
  databaseUrl: string,
  applicationName: string,
): Sql {
  return postgres(databaseUrl, {
    connect_timeout: 3,
    connection: {
      application_name: applicationName,
      statement_timeout: 10_000,
    },
    idle_timeout: 5,
    max: 1,
    max_lifetime: 60,
  });
}

export function retargetDatabase(
  databaseUrl: string,
  database: string,
): string {
  const parsed = new URL(databaseUrl);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

export async function closeSqlClients(clients: readonly Sql[]): Promise<void> {
  await Promise.all(clients.map((client) => client.end({ timeout: 1 })));
}
