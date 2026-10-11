import {
  createPostgresRepositoryCapability,
  type PostgresRepositoryCapability,
} from "@/database/postgres-repository";

import {
  readDatabaseUrl,
  rejectConfiguredKeys,
  type RuntimeEnvironment,
} from "./environment";

declare const demoRepositoryBrand: unique symbol;

export interface DemoRepositoryCapability extends PostgresRepositoryCapability<"demo"> {
  readonly [demoRepositoryBrand]: true;
}

export interface DemoRuntimeContext {
  readonly mode: "demo";
  readonly repository: DemoRepositoryCapability;
}

const FORBIDDEN_DEMO_KEYS = [
  "DATABASE_URL",
  "DEMO_MIGRATION_DATABASE_URL",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "OWNER_GITHUB_ID",
  "PRIMARY_DATABASE_URL",
  "PRIMARY_MIGRATION_DATABASE_URL",
  "RESEND_API_KEY",
] as const;

export function createDemoRuntime(
  environment: RuntimeEnvironment,
): DemoRuntimeContext {
  rejectConfiguredKeys(environment, FORBIDDEN_DEMO_KEYS);
  const databaseUrl = readDatabaseUrl(environment, "DEMO_DATABASE_URL");
  const repository = createPostgresRepositoryCapability({
    databaseUrl,
    mode: "demo",
  }) as DemoRepositoryCapability;

  return Object.freeze({
    mode: "demo" as const,
    repository,
  });
}
