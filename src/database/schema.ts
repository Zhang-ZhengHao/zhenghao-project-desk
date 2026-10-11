import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

const timestampWithTimezone = (name: string) =>
  timestamp(name, { mode: "date", withTimezone: true });

export const inquiries = pgTable(
  "inquiries",
  {
    id: text("id").primaryKey(),
    status: text("status").default("pending_verification").notNull(),
    contactName: text("contact_name").notNull(),
    organization: text("organization"),
    email: text("email").notNull(),
    projectType: text("project_type").notNull(),
    budgetRange: text("budget_range").notNull(),
    timeline: text("timeline").notNull(),
    brief: text("brief").notNull(),
    sourceLabel: text("source_label").default("public_intake").notNull(),
    verifiedAt: timestampWithTimezone("verified_at"),
    retentionUntil: timestampWithTimezone("retention_until").notNull(),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
    updatedAt: timestampWithTimezone("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "inquiries_status_check",
      sql`${table.status} in ('pending_verification', 'received', 'reviewing', 'accepted', 'declined', 'closed', 'expired')`,
    ),
    check(
      "inquiries_contact_name_length_check",
      sql`char_length(${table.contactName}) between 1 and 100`,
    ),
    check(
      "inquiries_organization_length_check",
      sql`${table.organization} is null or char_length(${table.organization}) between 1 and 120`,
    ),
    check(
      "inquiries_email_length_check",
      sql`char_length(${table.email}) between 3 and 254`,
    ),
    check(
      "inquiries_brief_length_check",
      sql`char_length(${table.brief}) between 1 and 8000`,
    ),
    index("inquiries_status_created_at_idx").on(table.status, table.createdAt),
  ],
);

export const inquiryLinks = pgTable(
  "inquiry_links",
  {
    id: text("id").primaryKey(),
    inquiryId: text("inquiry_id")
      .notNull()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    url: text("url").notNull(),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("inquiry_links_inquiry_position_key").on(
      table.inquiryId,
      table.position,
    ),
    check(
      "inquiry_links_position_check",
      sql`${table.position} between 0 and 2`,
    ),
    check(
      "inquiry_links_url_length_check",
      sql`char_length(${table.url}) between 1 and 2048`,
    ),
    index("inquiry_links_inquiry_id_idx").on(table.inquiryId),
  ],
);

export const outboxMessages = pgTable(
  "outbox_messages",
  {
    id: text("id").primaryKey(),
    messageKey: text("message_key").notNull(),
    template: text("template").notNull(),
    recipient: text("recipient").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: timestampWithTimezone("lease_expires_at"),
    nextAttemptAt: timestampWithTimezone("next_attempt_at")
      .defaultNow()
      .notNull(),
    sentAt: timestampWithTimezone("sent_at"),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
    updatedAt: timestampWithTimezone("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("outbox_messages_message_key_key").on(table.messageKey),
    check(
      "outbox_messages_status_check",
      sql`${table.status} in ('pending', 'leased', 'sent', 'failed', 'cancelled')`,
    ),
    check(
      "outbox_messages_attempts_check",
      sql`${table.attempts} between 0 and 4`,
    ),
    index("outbox_messages_delivery_idx").on(table.status, table.nextAttemptAt),
  ],
);

export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    dimension: text("dimension").notNull(),
    bucketHash: text("bucket_hash").notNull(),
    windowStartedAt: timestampWithTimezone("window_started_at").notNull(),
    count: integer("count").default(0).notNull(),
    expiresAt: timestampWithTimezone("expires_at").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.dimension, table.bucketHash, table.windowStartedAt],
      name: "rate_limit_buckets_pkey",
    }),
    check("rate_limit_buckets_count_check", sql`${table.count} >= 0`),
    index("rate_limit_buckets_expiry_idx").on(table.expiresAt),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    actionKey: text("action_key").notNull(),
    actorType: text("actor_type").notNull(),
    action: text("action").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    details: jsonb("details")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    occurredAt: timestampWithTimezone("occurred_at").defaultNow().notNull(),
  },
  (table) => [
    unique("audit_events_action_key_key").on(table.actionKey),
    index("audit_events_subject_timeline_idx").on(
      table.subjectType,
      table.subjectId,
      table.occurredAt,
    ),
  ],
);

// Better Auth 1.7.7 core schema, generated for PostgreSQL with the default
// singular model names and snake_case physical columns.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const applicationTables = [
  inquiries,
  inquiryLinks,
  outboxMessages,
  rateLimitBuckets,
  auditEvents,
] as const;

export const authTables = [user, session, account, verification] as const;
