import { describe, expect, it, vi } from "vitest";

import { createMigrationReadinessCheck } from "@/database/readiness";
import { EXPECTED_MIGRATIONS } from "@/database/migration-state";

describe("database readiness", () => {
  it("accepts only the exact committed migration journal", async () => {
    const readAppliedMigrations = vi
      .fn()
      .mockResolvedValue(
        EXPECTED_MIGRATIONS.map(({ createdAt, hash }) => ({ createdAt, hash })),
      );
    const checkReadiness = createMigrationReadinessCheck(readAppliedMigrations);

    await expect(checkReadiness()).resolves.toBe(true);
    expect(readAppliedMigrations).toHaveBeenCalledOnce();
  });

  it.each([[[]], [[{ createdAt: 9_999_999_999_999, hash: "f".repeat(64) }]]])(
    "rejects an absent or incompatible migration journal",
    async (rows) => {
      const checkReadiness = createMigrationReadinessCheck(async () => rows);

      await expect(checkReadiness()).resolves.toBe(false);
    },
  );

  it("does not reinterpret a database failure as a ready state", async () => {
    const failure = new Error("synthetic database failure");
    const checkReadiness = createMigrationReadinessCheck(async () => {
      throw failure;
    });

    await expect(checkReadiness()).rejects.toBe(failure);
  });
});
