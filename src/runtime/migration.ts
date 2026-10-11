import {
  readDatabaseUrl,
  readRuntimeMode,
  rejectConfiguredKeys,
  type RuntimeEnvironment,
  type RuntimeMode,
} from "./environment.ts";
import { RuntimeConfigurationError } from "./errors.ts";

export interface MigrationConfig {
  readonly databaseUrl: string;
  readonly mode: RuntimeMode;
}

const FORBIDDEN_PRIMARY_MIGRATION_KEYS = [
  "DATABASE_URL",
  "DEMO_DATABASE_URL",
  "DEMO_MIGRATION_DATABASE_URL",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "OWNER_GITHUB_ID",
  "PRIMARY_DATABASE_URL",
  "RESEND_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
] as const;

const FORBIDDEN_DEMO_MIGRATION_KEYS = [
  "DATABASE_URL",
  "DEMO_DATABASE_URL",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "OWNER_GITHUB_ID",
  "PRIMARY_DATABASE_URL",
  "PRIMARY_MIGRATION_DATABASE_URL",
  "RESEND_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
] as const;

export function readMigrationConfig(
  environment: RuntimeEnvironment,
  expectedMode: RuntimeMode,
): MigrationConfig {
  const mode = readRuntimeMode(environment);
  if (mode !== expectedMode) {
    throw new RuntimeConfigurationError("migration_mode_mismatch");
  }

  if (mode === "primary") {
    rejectConfiguredKeys(environment, FORBIDDEN_PRIMARY_MIGRATION_KEYS);
    return Object.freeze({
      databaseUrl: readDatabaseUrl(
        environment,
        "PRIMARY_MIGRATION_DATABASE_URL",
      ),
      mode,
    });
  }

  rejectConfiguredKeys(environment, FORBIDDEN_DEMO_MIGRATION_KEYS);
  return Object.freeze({
    databaseUrl: readDatabaseUrl(environment, "DEMO_MIGRATION_DATABASE_URL"),
    mode,
  });
}
