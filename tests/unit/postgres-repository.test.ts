import { describe, expect, it, vi } from "vitest";

import { EXPECTED_MIGRATIONS } from "@/database/migration-state";
import { createPostgresRepositoryCapability } from "@/database/postgres-repository";

const SYNTHETIC_URL =
  "postgresql://primary_app:synthetic@primary.db.invalid/project_desk_primary";

describe("PostgreSQL repository capability", () => {
  it("opens only when readiness is requested and reuses one scoped client", async () => {
    const readAppliedMigrations = vi
      .fn()
      .mockResolvedValue(
        EXPECTED_MIGRATIONS.map(({ createdAt, hash }) => ({ createdAt, hash })),
      );
    const close = vi.fn().mockResolvedValue(undefined);
    const createClient = vi.fn(() => ({ close, readAppliedMigrations }));
    const repository = createPostgresRepositoryCapability({
      createClient,
      databaseUrl: SYNTHETIC_URL,
      mode: "primary",
    });

    expect(createClient).not.toHaveBeenCalled();
    await expect(repository.checkReadiness()).resolves.toBe(true);
    await expect(repository.checkReadiness()).resolves.toBe(true);

    expect(createClient).toHaveBeenCalledOnce();
    expect(createClient).toHaveBeenCalledWith(SYNTHETIC_URL, "primary");
    expect(readAppliedMigrations).toHaveBeenCalledTimes(2);
    expect("databaseUrl" in repository).toBe(false);
    expect(JSON.stringify(repository)).not.toContain(SYNTHETIC_URL);

    await repository.close();
    expect(close).toHaveBeenCalledOnce();
  });

  it("does not create a connection when an unused capability closes", async () => {
    const createClient = vi.fn();
    const repository = createPostgresRepositoryCapability({
      createClient,
      databaseUrl: SYNTHETIC_URL,
      mode: "primary",
    });

    await repository.close();

    expect(createClient).not.toHaveBeenCalled();
  });
});
