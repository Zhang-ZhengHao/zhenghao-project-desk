import { resolve } from "node:path";

import { afterAll, afterEach, describe, expect, it } from "vitest";

import { GET as getHealth } from "@/app/health/route";
import {
  EXPECTED_MIGRATIONS,
  type AppliedMigration,
} from "@/database/migration-state";
import { MigrationStateError } from "@/database/migration-runner";
import { migratePostgresDatabase } from "@/database/postgres-migrator";
import { createReadinessHandler } from "@/readiness/handler";
import { createRuntimeContext } from "@/runtime";

import {
  closeSqlClients,
  createTestSql,
  loadTestDatabaseUrls,
  retargetDatabase,
} from "./support/postgres";

const projectRoot = resolve(import.meta.dirname, "../..");
const migrationsFolder = resolve(projectRoot, "drizzle");
const databaseUrls = loadTestDatabaseUrls();
const primaryMigrator = createTestSql(
  databaseUrls.primaryMigrator,
  "integration-primary-migrator",
);
const demoMigrator = createTestSql(
  databaseUrls.demoMigrator,
  "integration-demo-migrator",
);
const primaryAdmin = createTestSql(
  retargetDatabase(databaseUrls.admin, "project_desk_primary"),
  "integration-primary-admin",
);

const expectedJournal = EXPECTED_MIGRATIONS.map(({ createdAt, hash }) => ({
  createdAt,
  hash,
}));

async function readJournal(
  sql: typeof primaryMigrator,
): Promise<readonly AppliedMigration[]> {
  const rows = await sql<Array<{ createdAt: number | string; hash: string }>>`
    select "hash", "created_at" as "createdAt"
    from "drizzle"."__drizzle_migrations"
    order by "created_at" asc
  `;
  return rows.map(({ createdAt, hash }) => ({
    createdAt: Number(createdAt),
    hash,
  }));
}

async function restorePrimaryJournal(): Promise<void> {
  const expected = EXPECTED_MIGRATIONS[0]!;
  await primaryMigrator`
    delete from "drizzle"."__drizzle_migrations"
    where "created_at" is distinct from ${expected.createdAt}
  `;
  await primaryMigrator`
    update "drizzle"."__drizzle_migrations"
    set "hash" = ${expected.hash}
    where "created_at" = ${expected.createdAt}
  `;
  await primaryMigrator`
    insert into "drizzle"."__drizzle_migrations" ("hash", "created_at")
    select ${expected.hash}, ${expected.createdAt}
    where not exists (
      select 1
      from "drizzle"."__drizzle_migrations"
      where "created_at" = ${expected.createdAt}
    )
  `;
}

async function schemaFingerprint(sql: typeof primaryMigrator) {
  const [columns, constraints, indexes] = await Promise.all([
    sql`
      select
        table_schema as "schema",
        table_name as "table",
        column_name as "column",
        ordinal_position as "position",
        data_type as "dataType",
        udt_name as "underlyingType",
        is_nullable as "nullable",
        coalesce(column_default, '') as "defaultValue"
      from information_schema.columns
      where table_schema in ('public', 'drizzle')
      order by table_schema, table_name, ordinal_position
    `,
    sql`
      select
        namespace.nspname as "schema",
        relation.relname as "table",
        constraint_record.conname as "name",
        constraint_record.contype as "type",
        pg_get_constraintdef(constraint_record.oid, true) as "definition"
      from pg_constraint as constraint_record
      join pg_class as relation
        on relation.oid = constraint_record.conrelid
      join pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname in ('public', 'drizzle')
      order by namespace.nspname, relation.relname, constraint_record.conname
    `,
    sql`
      select
        schemaname as "schema",
        tablename as "table",
        indexname as "name",
        indexdef as "definition"
      from pg_indexes
      where schemaname in ('public', 'drizzle')
      order by schemaname, tablename, indexname
    `,
  ]);

  return { columns, constraints, indexes };
}

afterEach(async () => {
  await restorePrimaryJournal();
});

afterAll(async () => {
  await closeSqlClients([primaryMigrator, demoMigrator, primaryAdmin]);
});

describe("PostgreSQL migrations", () => {
  it("leaves both databases on the exact committed journal after a repeat run", async () => {
    expect(await readJournal(primaryMigrator)).toEqual(expectedJournal);
    expect(await readJournal(demoMigrator)).toEqual(expectedJournal);

    await migratePostgresDatabase(
      databaseUrls.primaryMigrator,
      migrationsFolder,
      "primary",
    );
    await migratePostgresDatabase(
      databaseUrls.demoMigrator,
      migrationsFolder,
      "demo",
    );

    expect(await readJournal(primaryMigrator)).toEqual(expectedJournal);
    expect(await readJournal(demoMigrator)).toEqual(expectedJournal);
  });

  it("creates identical primary and demo schemas with all nine public tables", async () => {
    const primaryFingerprint = await schemaFingerprint(primaryMigrator);
    const demoFingerprint = await schemaFingerprint(demoMigrator);
    expect(primaryFingerprint).toEqual(demoFingerprint);

    const tables = await primaryMigrator<Array<{ table: string }>>`
      select table_name as "table"
      from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name
    `;
    expect(tables.map(({ table }) => table)).toEqual([
      "account",
      "audit_events",
      "inquiries",
      "inquiry_links",
      "outbox_messages",
      "rate_limit_buckets",
      "session",
      "user",
      "verification",
    ]);
  });

  it("serializes concurrent migration processes with a PostgreSQL advisory lock", async () => {
    await primaryAdmin`select pg_advisory_lock(805221, 2)`;

    const migration = migratePostgresDatabase(
      databaseUrls.primaryMigrator,
      migrationsFolder,
      "primary",
    );
    try {
      await expect
        .poll(
          async () => {
            const [row] = await primaryAdmin<Array<{ waiting: number }>>`
              select count(*)::int as "waiting"
              from pg_locks as lock_record
              join pg_stat_activity as activity
                on activity.pid = lock_record.pid
              where lock_record.locktype = 'advisory'
                and lock_record.database = (
                  select oid from pg_database where datname = current_database()
                )
                and lock_record.classid = 805221
                and lock_record.objid = 2
                and lock_record.objsubid = 2
                and not lock_record.granted
                and activity.application_name = 'project-desk-primary-migrator'
            `;
            return row?.waiting ?? 0;
          },
          { interval: 50, timeout: 5_000 },
        )
        .toBe(1);
    } finally {
      await primaryAdmin`select pg_advisory_unlock(805221, 2)`;
      await migration;
    }
  });

  it("rejects a changed checksum before applying another migration", async () => {
    await primaryMigrator`
      update "drizzle"."__drizzle_migrations"
      set "hash" = ${"0".repeat(64)}
      where "created_at" = ${EXPECTED_MIGRATIONS[0]!.createdAt}
    `;

    await expect(
      migratePostgresDatabase(
        databaseUrls.primaryMigrator,
        migrationsFolder,
        "primary",
      ),
    ).rejects.toBeInstanceOf(MigrationStateError);
  });

  it("fails safely when the applied journal contains an unknown migration", async () => {
    const unexpectedCreatedAt = EXPECTED_MIGRATIONS[0]!.createdAt + 1;
    await primaryMigrator`
      insert into "drizzle"."__drizzle_migrations" ("hash", "created_at")
      values (${"f".repeat(64)}, ${unexpectedCreatedAt})
    `;

    await expect(
      migratePostgresDatabase(
        databaseUrls.primaryMigrator,
        migrationsFolder,
        "primary",
      ),
    ).rejects.toBeInstanceOf(MigrationStateError);

    const runtime = await createRuntimeContext({
      APP_MODE: "primary",
      PRIMARY_DATABASE_URL: databaseUrls.primaryApp,
    });
    try {
      const response = await createReadinessHandler(async () => runtime)();
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({ status: "not_ready" });
    } finally {
      await runtime.repository.close();
    }
  });

  it("keeps liveness independent while empty and unreachable databases are not ready", async () => {
    const emptyRuntime = await createRuntimeContext({
      APP_MODE: "primary",
      PRIMARY_DATABASE_URL: databaseUrls.admin,
    });
    const stoppedRuntime = await createRuntimeContext({
      APP_MODE: "primary",
      PRIMARY_DATABASE_URL:
        "postgresql://primary_app:placeholder@127.0.0.1:1/project_desk_primary",
    });

    try {
      const emptyResponse = await createReadinessHandler(
        async () => emptyRuntime,
      )();
      const stoppedResponse = await createReadinessHandler(
        async () => stoppedRuntime,
      )();

      expect(emptyResponse.status).toBe(503);
      expect(stoppedResponse.status).toBe(503);
      expect(getHealth().status).toBe(200);
    } finally {
      await emptyRuntime.repository.close();
      await stoppedRuntime.repository.close();
    }
  });
});
