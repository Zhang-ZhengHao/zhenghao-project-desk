import postgres from "postgres";

import type { RuntimeMode } from "@/runtime/environment";

import type { AppliedMigration } from "./migration-state";
import { createMigrationReadinessCheck } from "./readiness";

interface MigrationJournalClient {
  close(): Promise<void>;
  readAppliedMigrations(): Promise<readonly AppliedMigration[]>;
}

type JournalClientFactory = (
  databaseUrl: string,
  mode: RuntimeMode,
) => MigrationJournalClient;

export interface PostgresRepositoryCapability<
  Mode extends RuntimeMode = RuntimeMode,
> {
  readonly mode: Mode;
  checkReadiness(): Promise<boolean>;
  close(): Promise<void>;
}

interface PostgresRepositoryOptions<Mode extends RuntimeMode> {
  readonly createClient?: JournalClientFactory;
  readonly databaseUrl: string;
  readonly mode: Mode;
}

function createPostgresJournalClient(
  databaseUrl: string,
  mode: RuntimeMode,
): MigrationJournalClient {
  const sql = postgres(databaseUrl, {
    connect_timeout: 3,
    connection: {
      application_name: `project-desk-${mode}`,
      statement_timeout: 3_000,
    },
    idle_timeout: 20,
    max: 4,
    max_lifetime: 30 * 60,
  });

  return {
    async close() {
      await sql.end({ timeout: 1 });
    },
    async readAppliedMigrations() {
      const rows = await sql<
        Array<{ createdAt: number | string; hash: string }>
      >`
        select "hash", "created_at" as "createdAt"
        from "drizzle"."__drizzle_migrations"
        order by "created_at" asc
      `;
      return rows;
    },
  };
}

export function createPostgresRepositoryCapability<Mode extends RuntimeMode>({
  createClient = createPostgresJournalClient,
  databaseUrl,
  mode,
}: PostgresRepositoryOptions<Mode>): PostgresRepositoryCapability<Mode> {
  let client: MigrationJournalClient | undefined;

  const getClient = () => {
    client ??= createClient(databaseUrl, mode);
    return client;
  };

  return Object.freeze({
    mode,
    async checkReadiness() {
      return createMigrationReadinessCheck(() =>
        getClient().readAppliedMigrations(),
      )();
    },
    async close() {
      if (client !== undefined) {
        await client.close();
      }
    },
  });
}
