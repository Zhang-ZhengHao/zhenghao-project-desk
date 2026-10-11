import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import type { RuntimeMode } from "../runtime/environment.ts";
import type { AppliedMigration } from "./migration-state.ts";
import {
  executeMigrations,
  type MigrationExecutor,
} from "./migration-runner.ts";

const MIGRATION_LOCK_NAMESPACE = 805_221;
const MIGRATION_LOCK_ID = 2;

interface PostgresMigrationExecutor extends MigrationExecutor {
  close(): Promise<void>;
}

function createPostgresMigrationExecutor(
  databaseUrl: string,
  migrationsFolder: string,
  mode: RuntimeMode,
): PostgresMigrationExecutor {
  const sql = postgres(databaseUrl, {
    connect_timeout: 5,
    connection: {
      application_name: `project-desk-${mode}-migrator`,
      statement_timeout: 30_000,
    },
    idle_timeout: 20,
    max: 1,
    max_lifetime: 30 * 60,
  });
  const database = drizzle(sql);

  return {
    async acquireLock() {
      await sql`select pg_advisory_lock(${MIGRATION_LOCK_NAMESPACE}, ${MIGRATION_LOCK_ID})`;
    },
    async applyPendingMigrations() {
      await migrate(database, { migrationsFolder });
    },
    async close() {
      await sql.end({ timeout: 1 });
    },
    async readAppliedMigrations(): Promise<readonly AppliedMigration[]> {
      const [journal] = await sql<Array<{ tableName: string | null }>>`
        select to_regclass('drizzle.__drizzle_migrations')::text as "tableName"
      `;
      if (journal?.tableName === null || journal === undefined) {
        return [];
      }

      return sql<Array<{ createdAt: number | string; hash: string }>>`
        select "hash", "created_at" as "createdAt"
        from "drizzle"."__drizzle_migrations"
        order by "created_at" asc
      `;
    },
    async releaseLock() {
      await sql`select pg_advisory_unlock(${MIGRATION_LOCK_NAMESPACE}, ${MIGRATION_LOCK_ID})`;
    },
  };
}

export async function migratePostgresDatabase(
  databaseUrl: string,
  migrationsFolder: string,
  mode: RuntimeMode,
): Promise<void> {
  const executor = createPostgresMigrationExecutor(
    databaseUrl,
    migrationsFolder,
    mode,
  );
  try {
    await executeMigrations(executor);
  } finally {
    await executor.close();
  }
}
