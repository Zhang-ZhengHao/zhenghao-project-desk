import { describe, expect, it, vi } from "vitest";

import { EXPECTED_MIGRATIONS } from "@/database/migration-state";
import {
  MigrationStateError,
  executeMigrations,
} from "@/database/migration-runner";

const currentJournal = EXPECTED_MIGRATIONS.map(({ createdAt, hash }) => ({
  createdAt,
  hash,
}));

describe("migration runner", () => {
  it("locks, validates, applies, verifies and unlocks in order", async () => {
    const events: string[] = [];
    const executor = {
      acquireLock: vi.fn(async () => {
        events.push("lock");
      }),
      applyPendingMigrations: vi.fn(async () => {
        events.push("apply");
      }),
      readAppliedMigrations: vi
        .fn()
        .mockImplementationOnce(async () => {
          events.push("read-before");
          return [];
        })
        .mockImplementationOnce(async () => {
          events.push("read-after");
          return currentJournal;
        }),
      releaseLock: vi.fn(async () => {
        events.push("unlock");
      }),
    };

    await executeMigrations(executor);

    expect(events).toEqual([
      "lock",
      "read-before",
      "apply",
      "read-after",
      "unlock",
    ]);
  });

  it("does not apply over a divergent journal and always releases the lock", async () => {
    const executor = {
      acquireLock: vi.fn().mockResolvedValue(undefined),
      applyPendingMigrations: vi.fn().mockResolvedValue(undefined),
      readAppliedMigrations: vi.fn().mockResolvedValue([
        {
          createdAt: EXPECTED_MIGRATIONS[0]!.createdAt,
          hash: "changed-migration-content",
        },
      ]),
      releaseLock: vi.fn().mockResolvedValue(undefined),
    };

    await expect(executeMigrations(executor)).rejects.toBeInstanceOf(
      MigrationStateError,
    );
    expect(executor.applyPendingMigrations).not.toHaveBeenCalled();
    expect(executor.releaseLock).toHaveBeenCalledOnce();
  });

  it("releases the lock when applying a migration fails", async () => {
    const failure = new Error("synthetic migration failure");
    const executor = {
      acquireLock: vi.fn().mockResolvedValue(undefined),
      applyPendingMigrations: vi.fn().mockRejectedValue(failure),
      readAppliedMigrations: vi.fn().mockResolvedValue([]),
      releaseLock: vi.fn().mockResolvedValue(undefined),
    };

    await expect(executeMigrations(executor)).rejects.toBe(failure);
    expect(executor.releaseLock).toHaveBeenCalledOnce();
  });

  it("fails when the journal is still incomplete after migration", async () => {
    const executor = {
      acquireLock: vi.fn().mockResolvedValue(undefined),
      applyPendingMigrations: vi.fn().mockResolvedValue(undefined),
      readAppliedMigrations: vi.fn().mockResolvedValue([]),
      releaseLock: vi.fn().mockResolvedValue(undefined),
    };

    await expect(executeMigrations(executor)).rejects.toBeInstanceOf(
      MigrationStateError,
    );
  });
});
