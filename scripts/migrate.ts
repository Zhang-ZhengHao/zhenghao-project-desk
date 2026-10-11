import { resolve } from "node:path";

import { migratePostgresDatabase } from "../src/database/postgres-migrator.ts";
import type { RuntimeMode } from "../src/runtime/environment.ts";
import { readMigrationConfig } from "../src/runtime/migration.ts";

function parseTarget(value: string | undefined): RuntimeMode {
  if (value !== "primary" && value !== "demo") {
    throw new Error("invalid migration target");
  }
  return value;
}

async function main(): Promise<number> {
  let target: RuntimeMode;
  let config: ReturnType<typeof readMigrationConfig>;

  try {
    target = parseTarget(process.argv[2]);
    config = readMigrationConfig(process.env, target);
  } catch {
    console.error("Migration configuration failed.");
    return 1;
  }

  try {
    await migratePostgresDatabase(
      config.databaseUrl,
      resolve(import.meta.dirname, "../drizzle"),
      target,
    );
    console.log(`Migration complete for ${target}.`);
    return 0;
  } catch {
    console.error("Migration failed.");
    return 1;
  }
}

process.exitCode = await main();
