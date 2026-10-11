import { describe, expect, it } from "vitest";

import { readMigrationConfig } from "@/runtime/migration";

const PRIMARY_MIGRATION_URL =
  "postgresql://primary_migrator:synthetic@primary.db.invalid/project_desk_primary";
const DEMO_MIGRATION_URL =
  "postgresql://demo_migrator:synthetic@demo.db.invalid/project_desk_demo";

describe("migration configuration boundary", () => {
  it.each([
    ["primary", "PRIMARY_MIGRATION_DATABASE_URL", PRIMARY_MIGRATION_URL],
    ["demo", "DEMO_MIGRATION_DATABASE_URL", DEMO_MIGRATION_URL],
  ] as const)(
    "loads only the %s migrator target",
    (mode, databaseKey, databaseUrl) => {
      const config = readMigrationConfig(
        { APP_MODE: mode, [databaseKey]: databaseUrl },
        mode,
      );

      expect(config).toEqual({ databaseUrl, mode });
      expect(Object.isFrozen(config)).toBe(true);
    },
  );

  it("rejects a command whose fixed target disagrees with APP_MODE", () => {
    expect(() =>
      readMigrationConfig(
        {
          APP_MODE: "demo",
          DEMO_MIGRATION_DATABASE_URL: DEMO_MIGRATION_URL,
        },
        "primary",
      ),
    ).toThrow(expect.objectContaining({ code: "migration_mode_mismatch" }));
  });

  it.each([
    "DATABASE_URL",
    "PRIMARY_DATABASE_URL",
    "DEMO_DATABASE_URL",
    "DEMO_MIGRATION_DATABASE_URL",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "OWNER_GITHUB_ID",
    "RESEND_API_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
  ])("rejects %s in the primary migration process", (key) => {
    expect(() =>
      readMigrationConfig(
        {
          APP_MODE: "primary",
          PRIMARY_MIGRATION_DATABASE_URL: PRIMARY_MIGRATION_URL,
          [key]: "",
        },
        "primary",
      ),
    ).toThrow(expect.objectContaining({ code: "mixed_runtime_credentials" }));
  });

  it.each([
    "DATABASE_URL",
    "DEMO_DATABASE_URL",
    "PRIMARY_DATABASE_URL",
    "PRIMARY_MIGRATION_DATABASE_URL",
    "RESEND_API_KEY",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "OWNER_GITHUB_ID",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
  ])("rejects %s in the demo migration process", (key) => {
    expect(() =>
      readMigrationConfig(
        {
          APP_MODE: "demo",
          DEMO_MIGRATION_DATABASE_URL: DEMO_MIGRATION_URL,
          [key]: "",
        },
        "demo",
      ),
    ).toThrow(expect.objectContaining({ code: "mixed_runtime_credentials" }));
  });

  it.each([
    ["primary", "PRIMARY_MIGRATION_DATABASE_URL"],
    ["demo", "DEMO_MIGRATION_DATABASE_URL"],
  ] as const)("requires a valid %s migration target", (mode, key) => {
    expect(() => readMigrationConfig({ APP_MODE: mode }, mode)).toThrow(
      expect.objectContaining({ code: "missing_database_url" }),
    );
    expect(() =>
      readMigrationConfig(
        { APP_MODE: mode, [key]: "mysql://db.invalid/project" },
        mode,
      ),
    ).toThrow(expect.objectContaining({ code: "invalid_database_url" }));
  });

  it("does not include a rejected migration credential in the error", () => {
    const value =
      "postgresql://private_migrator:private_password@private.db.invalid/project";

    let failure: unknown;
    try {
      readMigrationConfig(
        {
          APP_MODE: "primary",
          PRIMARY_MIGRATION_DATABASE_URL: value,
          DEMO_MIGRATION_DATABASE_URL: "synthetic-forbidden-value",
        },
        "primary",
      );
    } catch (error) {
      failure = error;
    }

    expect(String(failure)).not.toContain(value);
    expect(String(failure)).not.toContain("private_password");
    expect(String(failure)).not.toContain("synthetic-forbidden-value");
  });
});
