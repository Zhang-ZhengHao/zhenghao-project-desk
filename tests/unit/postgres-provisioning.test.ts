import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");
const provisioningSqlPath = resolve(
  projectRoot,
  "scripts/ci/provision-postgres.sql",
);

function readProvisioningSql() {
  return readFileSync(provisioningSqlPath, "utf8").replace(/\s+/gu, " ");
}

describe("PostgreSQL CI provisioning", () => {
  it("creates four login roles without elevated cluster capabilities", () => {
    const sql = readProvisioningSql();

    for (const role of [
      "primary_app",
      "primary_migrator",
      "demo_app",
      "demo_migrator",
    ]) {
      expect(sql).toMatch(
        new RegExp(
          `CREATE ROLE ${role} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
          "u",
        ),
      );
    }
  });

  it.each([
    ["primary", "primary_app", "primary_migrator"],
    ["demo", "demo_app", "demo_migrator"],
  ] as const)(
    "isolates the %s database and grants only its two roles access",
    (mode, appRole, migratorRole) => {
      const sql = readProvisioningSql();
      const database = `project_desk_${mode}`;

      expect(sql).toContain(
        `CREATE DATABASE ${database} OWNER ${migratorRole}`,
      );
      expect(sql).toContain(`REVOKE ALL ON DATABASE ${database} FROM PUBLIC`);
      expect(sql).toContain(
        `GRANT CONNECT ON DATABASE ${database} TO ${appRole}, ${migratorRole}`,
      );
    },
  );

  it("removes default role access to PostgreSQL maintenance databases", () => {
    const sql = readProvisioningSql();

    expect(sql).toContain("REVOKE CONNECT ON DATABASE postgres FROM PUBLIC");
    expect(sql).toContain("REVOKE CONNECT ON DATABASE template1 FROM PUBLIC");
  });

  it.each([
    ["primary", "primary_app", "primary_migrator"],
    ["demo", "demo_app", "demo_migrator"],
  ] as const)(
    "gives the %s app DML and journal-read capabilities without DDL",
    (mode, appRole, migratorRole) => {
      const sql = readProvisioningSql();
      const databaseSection = sql.split(`\\connect project_desk_${mode}`)[1];

      expect(databaseSection).toBeDefined();
      expect(databaseSection).toContain(
        `REVOKE ALL ON SCHEMA public FROM PUBLIC`,
      );
      expect(databaseSection).toContain(
        `GRANT USAGE ON SCHEMA public TO ${appRole}`,
      );
      expect(databaseSection).toContain(
        `CREATE SCHEMA drizzle AUTHORIZATION ${migratorRole}`,
      );
      expect(databaseSection).toContain(
        `GRANT USAGE ON SCHEMA drizzle TO ${appRole}`,
      );
      expect(databaseSection).toContain(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${migratorRole} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${appRole}`,
      );
      expect(databaseSection).toContain(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${migratorRole} IN SCHEMA drizzle GRANT SELECT ON TABLES TO ${appRole}`,
      );
      expect(databaseSection).not.toMatch(
        new RegExp(`GRANT (?:CREATE|ALL).* TO ${appRole}`, "u"),
      );
    },
  );
});
