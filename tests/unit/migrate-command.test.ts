import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");

function runMigration(
  mode: string,
  environment: Record<string, string | undefined>,
) {
  const env = { ...process.env };
  for (const key of [
    "APP_MODE",
    "DATABASE_URL",
    "DEMO_DATABASE_URL",
    "DEMO_MIGRATION_DATABASE_URL",
    "PRIMARY_DATABASE_URL",
    "PRIMARY_MIGRATION_DATABASE_URL",
  ]) {
    delete env[key];
  }
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) {
      delete env[key];
    } else {
      env[key] = value;
    }
  }

  return spawnSync(process.execPath, ["scripts/migrate.ts", mode], {
    cwd: projectRoot,
    encoding: "utf8",
    env,
  });
}

describe("migration command", () => {
  it("rejects an unknown fixed target without opening a database", () => {
    const result = runMigration("other", {});

    expect(result.status).not.toBe(0);
    expect(result.stderr).toBe("Migration configuration failed.\n");
    expect(result.stderr).not.toContain("undefined");
  });

  it("rejects a target mismatch without exposing a migration DSN", () => {
    const privateTarget =
      "postgresql://private_migrator:private_password@private.db.invalid/project";
    const result = runMigration("primary", {
      APP_MODE: "demo",
      DEMO_MIGRATION_DATABASE_URL: privateTarget,
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toBe("Migration configuration failed.\n");
    expect(result.stderr).not.toContain(privateTarget);
    expect(result.stderr).not.toContain("private_password");
  });
});
