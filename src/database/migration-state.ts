export interface ExpectedMigration {
  readonly createdAt: number;
  readonly hash: string;
  readonly tag: string;
}

export interface AppliedMigration {
  readonly createdAt: number | string;
  readonly hash: string;
}

export class MigrationStateError extends Error {
  readonly code = "migration_history_diverged";

  constructor() {
    super("The applied database migration history is incompatible.");
    this.name = "MigrationStateError";
  }
}

export const EXPECTED_MIGRATIONS: readonly ExpectedMigration[] = Object.freeze([
  Object.freeze({
    createdAt: 1_791_715_200_000,
    hash: "45eb0ed2bd4544785d64dd38fbfc3e37d7bb38b4783ec40bd20e6f398a3c6210",
    tag: "0000_runtime_boundary",
  }),
]);

export function isMigrationStateCurrent(
  appliedMigrations: readonly AppliedMigration[],
): boolean {
  if (appliedMigrations.length !== EXPECTED_MIGRATIONS.length) {
    return false;
  }

  return EXPECTED_MIGRATIONS.every((expected, index) => {
    const applied = appliedMigrations[index];
    return (
      applied !== undefined &&
      Number(applied.createdAt) === expected.createdAt &&
      applied.hash === expected.hash
    );
  });
}

export function assertAppliedMigrationPrefix(
  appliedMigrations: readonly AppliedMigration[],
): void {
  const isValidPrefix = appliedMigrations.every((applied, index) => {
    const expected = EXPECTED_MIGRATIONS[index];
    return (
      expected !== undefined &&
      Number(applied.createdAt) === expected.createdAt &&
      applied.hash === expected.hash
    );
  });

  if (!isValidPrefix) {
    throw new MigrationStateError();
  }
}
