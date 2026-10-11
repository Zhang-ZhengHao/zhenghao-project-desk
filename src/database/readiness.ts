import {
  isMigrationStateCurrent,
  type AppliedMigration,
} from "./migration-state";

type AppliedMigrationReader = () => Promise<readonly AppliedMigration[]>;

export function createMigrationReadinessCheck(
  readAppliedMigrations: AppliedMigrationReader,
) {
  return async function checkReadiness(): Promise<boolean> {
    const appliedMigrations = await readAppliedMigrations();
    return isMigrationStateCurrent(appliedMigrations);
  };
}
