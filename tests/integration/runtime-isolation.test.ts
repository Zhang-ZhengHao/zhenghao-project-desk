import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { createReadinessHandler } from "@/readiness/handler";
import { createRuntimeContext } from "@/runtime";

import {
  closeSqlClients,
  createTestSql,
  loadTestDatabaseUrls,
  retargetDatabase,
} from "./support/postgres";

const databaseUrls = loadTestDatabaseUrls();
const admin = createTestSql(databaseUrls.admin, "integration-role-audit");
const primaryApp = createTestSql(
  databaseUrls.primaryApp,
  "integration-primary-app",
);
const primaryMigrator = createTestSql(
  databaseUrls.primaryMigrator,
  "integration-primary-migrator-permissions",
);
const demoApp = createTestSql(databaseUrls.demoApp, "integration-demo-app");
const demoMigrator = createTestSql(
  databaseUrls.demoMigrator,
  "integration-demo-migrator-permissions",
);

async function connectionIsRejected(databaseUrl: string): Promise<boolean> {
  const client = createTestSql(databaseUrl, "integration-denied-connection");
  try {
    await client`select 1`;
    return false;
  } catch (error) {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "42501"
    );
  } finally {
    await client.end({ timeout: 1 });
  }
}

afterAll(async () => {
  await closeSqlClients([
    admin,
    primaryApp,
    primaryMigrator,
    demoApp,
    demoMigrator,
  ]);
});

describe("PostgreSQL runtime isolation", () => {
  it("keeps all four login roles free of elevated cluster capabilities", async () => {
    const roles = await admin<
      Array<{
        bypassRls: boolean;
        canLogin: boolean;
        createDatabase: boolean;
        createRole: boolean;
        name: string;
        replication: boolean;
        superuser: boolean;
      }>
    >`
      select
        rolname as "name",
        rolcanlogin as "canLogin",
        rolsuper as "superuser",
        rolcreatedb as "createDatabase",
        rolcreaterole as "createRole",
        rolreplication as "replication",
        rolbypassrls as "bypassRls"
      from pg_roles
      where rolname in (
        'primary_app',
        'primary_migrator',
        'demo_app',
        'demo_migrator'
      )
      order by rolname
    `;

    expect(roles).toHaveLength(4);
    for (const role of roles) {
      expect(role).toMatchObject({
        bypassRls: false,
        canLogin: true,
        createDatabase: false,
        createRole: false,
        replication: false,
        superuser: false,
      });
    }
  });

  it("rejects app and migrator credentials at the other runtime database", async () => {
    const attempts = [
      retargetDatabase(databaseUrls.primaryApp, "project_desk_demo"),
      retargetDatabase(databaseUrls.primaryMigrator, "project_desk_demo"),
      retargetDatabase(databaseUrls.demoApp, "project_desk_primary"),
      retargetDatabase(databaseUrls.demoMigrator, "project_desk_primary"),
      retargetDatabase(databaseUrls.primaryApp, "postgres"),
      retargetDatabase(databaseUrls.primaryMigrator, "postgres"),
      retargetDatabase(databaseUrls.demoApp, "postgres"),
      retargetDatabase(databaseUrls.demoMigrator, "postgres"),
    ];

    await expect(
      Promise.all(attempts.map(connectionIsRejected)),
    ).resolves.toEqual([true, true, true, true, true, true, true, true]);
  });

  it("allows business DML while denying schema and migration-journal writes", async () => {
    const inquiryId = `integration-${randomUUID()}`;
    const linkId = `integration-link-${randomUUID()}`;
    try {
      await primaryApp`
        insert into inquiries (
          id,
          contact_name,
          email,
          project_type,
          budget_range,
          timeline,
          brief,
          retention_until
        ) values (
          ${inquiryId},
          'Synthetic Client',
          'client@mail.invalid',
          'web_application',
          'synthetic_range',
          'synthetic_timeline',
          'Integration-only inquiry',
          now() + interval '1 day'
        )
      `;
      await primaryApp`
        insert into inquiry_links (id, inquiry_id, position, url)
        values (${linkId}, ${inquiryId}, 0, 'https://project.invalid/brief')
      `;
      await primaryApp`
        update inquiries set status = 'received' where id = ${inquiryId}
      `;

      const [journalCount] = await primaryApp<Array<{ count: number }>>`
        select count(*)::int as "count"
        from "drizzle"."__drizzle_migrations"
      `;
      expect(journalCount?.count).toBe(1);

      await expect(
        primaryApp`create table forbidden_app_ddl (id integer)`,
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        primaryApp`create temporary table forbidden_app_temp (id integer)`,
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        primaryApp`
          update "drizzle"."__drizzle_migrations"
          set "hash" = "hash"
        `,
      ).rejects.toMatchObject({ code: "42501" });

      await primaryApp`delete from inquiries where id = ${inquiryId}`;
      const [remainingLink] = await primaryApp<Array<{ count: number }>>`
        select count(*)::int as "count"
        from inquiry_links
        where id = ${linkId}
      `;
      expect(remainingLink?.count).toBe(0);
    } finally {
      await primaryMigrator`drop table if exists forbidden_app_ddl`;
      await primaryApp`delete from inquiries where id = ${inquiryId}`;
    }
  });

  it("keeps the public schema under the database owner and applies future-object ACLs", async () => {
    const [schemaOwner] = await primaryMigrator<Array<{ owner: string }>>`
      select pg_get_userbyid(nspowner) as "owner"
      from pg_namespace
      where nspname = 'public'
    `;
    expect(schemaOwner?.owner).toBe("pg_database_owner");

    await primaryMigrator`drop table if exists public.integration_future_acl`;
    await primaryMigrator`drop table if exists drizzle.integration_future_acl`;
    try {
      await primaryMigrator`
        create table public.integration_future_acl (
          id text primary key,
          value text not null
        )
      `;
      await primaryMigrator`
        create table drizzle.integration_future_acl (
          id text primary key
        )
      `;

      await primaryApp`
        insert into public.integration_future_acl (id, value)
        values ('synthetic', 'before')
      `;
      await primaryApp`
        update public.integration_future_acl
        set value = 'after'
        where id = 'synthetic'
      `;
      const [futureRow] = await primaryApp<Array<{ value: string }>>`
        select value
        from public.integration_future_acl
        where id = 'synthetic'
      `;
      expect(futureRow?.value).toBe("after");
      await primaryApp`
        delete from public.integration_future_acl where id = 'synthetic'
      `;

      const journalRows =
        await primaryApp`select id from drizzle.integration_future_acl`;
      expect(journalRows).toHaveLength(0);
      await expect(
        primaryApp`
          insert into drizzle.integration_future_acl (id)
          values ('forbidden')
        `,
      ).rejects.toMatchObject({ code: "42501" });
    } finally {
      await primaryMigrator`
        drop table if exists public.integration_future_acl
      `;
      await primaryMigrator`
        drop table if exists drizzle.integration_future_acl
      `;
    }
  });

  it("enforces schema constraints in the live database", async () => {
    const inquiryId = `integration-invalid-${randomUUID()}`;
    const outboxId = `integration-outbox-${randomUUID()}`;
    const messageKey = `integration-key-${randomUUID()}`;

    await expect(
      primaryApp`
        insert into inquiries (
          id,
          status,
          contact_name,
          email,
          project_type,
          budget_range,
          timeline,
          brief,
          retention_until
        ) values (
          ${inquiryId},
          'invalid_status',
          'Synthetic Client',
          'client@mail.invalid',
          'web_application',
          'synthetic_range',
          'synthetic_timeline',
          'Integration-only inquiry',
          now() + interval '1 day'
        )
      `,
    ).rejects.toMatchObject({ code: "23514" });

    try {
      await primaryApp`
        insert into outbox_messages (
          id,
          message_key,
          template,
          recipient,
          payload
        ) values (
          ${outboxId},
          ${messageKey},
          'integration_template',
          'client@mail.invalid',
          ${primaryApp.json({ synthetic: true })}
        )
      `;
      await expect(
        primaryApp`
          insert into outbox_messages (
            id,
            message_key,
            template,
            recipient,
            payload
          ) values (
            ${`duplicate-${outboxId}`},
            ${messageKey},
            'integration_template',
            'client@mail.invalid',
            ${primaryApp.json({ synthetic: true })}
          )
        `,
      ).rejects.toMatchObject({ code: "23505" });
    } finally {
      await primaryApp`
        delete from outbox_messages where message_key = ${messageKey}
      `;
      await primaryApp`delete from inquiries where id = ${inquiryId}`;
    }
  });

  it("keeps primary and demo rows isolated and ignores request-level mode hints", async () => {
    const primaryId = `primary-sentinel-${randomUUID()}`;
    const demoId = `demo-sentinel-${randomUUID()}`;
    const insertInquiry = async (
      sql: typeof primaryApp,
      id: string,
    ): Promise<void> => {
      await sql`
        insert into inquiries (
          id,
          contact_name,
          email,
          project_type,
          budget_range,
          timeline,
          brief,
          retention_until
        ) values (
          ${id},
          'Synthetic Client',
          'client@mail.invalid',
          'web_application',
          'synthetic_range',
          'synthetic_timeline',
          'Integration-only sentinel',
          now() + interval '1 day'
        )
      `;
    };

    try {
      await insertInquiry(primaryApp, primaryId);
      await insertInquiry(demoApp, demoId);

      const [primarySeesDemo] = await primaryApp<Array<{ count: number }>>`
        select count(*)::int as "count" from inquiries where id = ${demoId}
      `;
      const [demoSeesPrimary] = await demoApp<Array<{ count: number }>>`
        select count(*)::int as "count" from inquiries where id = ${primaryId}
      `;
      expect(primarySeesDemo?.count).toBe(0);
      expect(demoSeesPrimary?.count).toBe(0);

      const runtime = await createRuntimeContext({
        APP_MODE: "primary",
        PRIMARY_DATABASE_URL: databaseUrls.primaryApp,
      });
      try {
        const handler = createReadinessHandler(async () => runtime);
        const response = await handler(
          new Request("https://project.invalid/ready?mode=demo", {
            headers: {
              cookie: "APP_MODE=demo; mode=demo",
              "x-app-mode": "demo",
            },
          }),
        );

        expect(runtime.mode).toBe("primary");
        expect(runtime.repository.mode).toBe("primary");
        expect(response.status).toBe(200);
      } finally {
        await runtime.repository.close();
      }
    } finally {
      await primaryApp`delete from inquiries where id = ${primaryId}`;
      await demoApp`delete from inquiries where id = ${demoId}`;
    }
  });
});
