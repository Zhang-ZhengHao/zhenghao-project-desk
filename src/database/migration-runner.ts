import {
  MigrationStateError,
  assertAppliedMigrationPrefix,
  isMigrationStateCurrent,
  type AppliedMigration,
} from "./migration-state.ts";

export { MigrationStateError } from "./migration-state.ts";

export interface MigrationExecutor {
  acquireLock(): Promise<void>;
  applyPendingMigrations(): Promise<void>;
  readAppliedMigrations(): Promise<readonly AppliedMigration[]>;
  releaseLock(): Promise<void>;
}

export async function executeMigrations(
  executor: MigrationExecutor,
): Promise<void> {
  await executor.acquireLock();
  try {
    const before = await executor.readAppliedMigrations();
    assertAppliedMigrationPrefix(before);

    await executor.applyPendingMigrations();

    const after = await executor.readAppliedMigrations();
    if (!isMigrationStateCurrent(after)) {
      throw new MigrationStateError();
    }
  } finally {
    await executor.releaseLock();
  }
}
