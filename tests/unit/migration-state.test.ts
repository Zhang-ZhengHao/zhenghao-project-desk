import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  EXPECTED_MIGRATIONS,
  MigrationStateError,
  assertAppliedMigrationPrefix,
  isMigrationStateCurrent,
} from "@/database/migration-state";

const projectRoot = resolve(import.meta.dirname, "../..");

describe("migration state", () => {
  it("pins the committed SQL checksum and Drizzle journal timestamp", () => {
    const journal = JSON.parse(
      readFileSync(resolve(projectRoot, "drizzle/meta/_journal.json"), "utf8"),
    ) as {
      entries: Array<{ tag: string; when: number }>;
    };

    expect(EXPECTED_MIGRATIONS).toHaveLength(1);
    expect(journal.entries).toHaveLength(1);
    expect(journal.entries[0]).toMatchObject({
      tag: EXPECTED_MIGRATIONS[0]?.tag,
      when: EXPECTED_MIGRATIONS[0]?.createdAt,
    });

    for (const migration of EXPECTED_MIGRATIONS) {
      const sql = readFileSync(
        resolve(projectRoot, "drizzle", `${migration.tag}.sql`),
        "utf8",
      );
      const checksum = createHash("sha256").update(sql).digest("hex");
      expect(checksum).toBe(migration.hash);
    }
  });

  it("requires an exact ordered journal match", () => {
    const expected = EXPECTED_MIGRATIONS.map(({ createdAt, hash }) => ({
      createdAt,
      hash,
    }));

    expect(isMigrationStateCurrent(expected)).toBe(true);
    expect(isMigrationStateCurrent([])).toBe(false);
    expect(
      isMigrationStateCurrent([
        ...expected,
        { createdAt: 9_999_999_999_999, hash: "f".repeat(64) },
      ]),
    ).toBe(false);
    expect(
      isMigrationStateCurrent(
        expected.map((migration, index) =>
          index === 0 ? { ...migration, hash: "0".repeat(64) } : migration,
        ),
      ),
    ).toBe(false);
  });

  it("allows a valid prefix but rejects changed or unknown migrations", () => {
    const expected = EXPECTED_MIGRATIONS.map(({ createdAt, hash }) => ({
      createdAt,
      hash,
    }));

    expect(() => assertAppliedMigrationPrefix([])).not.toThrow();
    expect(() => assertAppliedMigrationPrefix(expected)).not.toThrow();
    expect(() =>
      assertAppliedMigrationPrefix([
        { ...expected[0]!, hash: "private-migration-content" },
      ]),
    ).toThrow(MigrationStateError);
    expect(() =>
      assertAppliedMigrationPrefix([
        ...expected,
        { createdAt: 9_999_999_999_999, hash: "f".repeat(64) },
      ]),
    ).toThrow(MigrationStateError);

    try {
      assertAppliedMigrationPrefix([
        { ...expected[0]!, hash: "private-migration-content" },
      ]);
    } catch (error) {
      expect(String(error)).not.toContain("private-migration-content");
      expect(error).toMatchObject({ code: "migration_history_diverged" });
    }
  });

  it("contains the scoped application and Better Auth tables", () => {
    const sql = readFileSync(
      resolve(projectRoot, "drizzle/0000_runtime_boundary.sql"),
      "utf8",
    );

    for (const table of [
      "inquiries",
      "inquiry_links",
      "outbox_messages",
      "rate_limit_buckets",
      "audit_events",
      "user",
      "session",
      "account",
      "verification",
    ]) {
      expect(sql).toContain(`CREATE TABLE "${table}"`);
    }
    expect(sql).not.toContain("proposal_versions");
    expect(sql).not.toContain("test_payments");
  });
});
