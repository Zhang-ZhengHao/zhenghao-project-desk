import {
  createPostgresRepositoryCapability,
  type PostgresRepositoryCapability,
} from "@/database/postgres-repository";

import {
  readDatabaseUrl,
  rejectConfiguredKeys,
  type RuntimeEnvironment,
} from "./environment";

declare const primaryRepositoryBrand: unique symbol;

export interface PrimaryRepositoryCapability extends PostgresRepositoryCapability<"primary"> {
  readonly [primaryRepositoryBrand]: true;
}

export interface PrimaryRuntimeContext {
  readonly mode: "primary";
  readonly repository: PrimaryRepositoryCapability;
}

const FORBIDDEN_PRIMARY_KEYS = [
  "DATABASE_URL",
  "DEMO_DATABASE_URL",
  "DEMO_MIGRATION_DATABASE_URL",
  "PRIMARY_MIGRATION_DATABASE_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
] as const;

export function createPrimaryRuntime(
  environment: RuntimeEnvironment,
): PrimaryRuntimeContext {
  rejectConfiguredKeys(environment, FORBIDDEN_PRIMARY_KEYS);
  const databaseUrl = readDatabaseUrl(environment, "PRIMARY_DATABASE_URL");
  const repository = createPostgresRepositoryCapability({
    databaseUrl,
    mode: "primary",
  }) as PrimaryRepositoryCapability;

  return Object.freeze({
    mode: "primary" as const,
    repository,
  });
}
