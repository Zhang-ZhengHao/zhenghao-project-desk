import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  account,
  applicationTables,
  auditEvents,
  authTables,
  inquiries,
  inquiryLinks,
  outboxMessages,
  rateLimitBuckets,
  session,
  user,
  verification,
} from "@/database/schema";

describe("database schema", () => {
  it("defines only the v0.1 application tables planned for this slice", () => {
    expect(applicationTables.map(getTableName)).toEqual([
      "inquiries",
      "inquiry_links",
      "outbox_messages",
      "rate_limit_buckets",
      "audit_events",
    ]);

    expect(applicationTables.map(getTableName)).not.toContain(
      "proposal_versions",
    );
    expect(applicationTables.map(getTableName)).not.toContain("test_payments");
  });

  it("defines the Better Auth 1.7.7 core tables and field names", () => {
    expect(authTables.map(getTableName)).toEqual([
      "user",
      "session",
      "account",
      "verification",
    ]);

    expect(Object.keys(getTableColumns(user))).toEqual([
      "id",
      "name",
      "email",
      "emailVerified",
      "image",
      "createdAt",
      "updatedAt",
    ]);
    expect(Object.keys(getTableColumns(session))).toEqual([
      "id",
      "expiresAt",
      "token",
      "createdAt",
      "updatedAt",
      "ipAddress",
      "userAgent",
      "userId",
    ]);
    expect(Object.keys(getTableColumns(account))).toEqual([
      "id",
      "accountId",
      "providerId",
      "userId",
      "accessToken",
      "refreshToken",
      "idToken",
      "accessTokenExpiresAt",
      "refreshTokenExpiresAt",
      "scope",
      "password",
      "createdAt",
      "updatedAt",
    ]);
    expect(Object.keys(getTableColumns(verification))).toEqual([
      "id",
      "identifier",
      "value",
      "expiresAt",
      "createdAt",
      "updatedAt",
    ]);
  });

  it("keeps inquiry links dependent on their inquiry", () => {
    const config = getTableConfig(inquiryLinks);
    const foreignKey = config.foreignKeys.at(0)?.reference();

    expect(foreignKey?.foreignTable).toBe(inquiries);
    expect(config.foreignKeys.at(0)?.onDelete).toBe("cascade");
    expect(config.uniqueConstraints).toHaveLength(1);
    expect(config.checks).toHaveLength(2);
  });

  it("uses constrained, non-null operational keys", () => {
    expect(getTableColumns(outboxMessages).messageKey.notNull).toBe(true);
    expect(getTableColumns(rateLimitBuckets).bucketHash.notNull).toBe(true);
    expect(getTableColumns(auditEvents).actionKey.notNull).toBe(true);
    expect(getTableConfig(rateLimitBuckets).primaryKeys).toHaveLength(1);
  });
});
