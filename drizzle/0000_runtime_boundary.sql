CREATE TABLE "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "session" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" timestamp NOT NULL,
  "token" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL,
  CONSTRAINT "session_token_unique" UNIQUE("token"),
  CONSTRAINT "session_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")
    ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "account" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp,
  "refresh_token_expires_at" timestamp,
  "scope" text,
  "password" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp NOT NULL,
  CONSTRAINT "account_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")
    ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inquiries" (
  "id" text PRIMARY KEY NOT NULL,
  "status" text DEFAULT 'pending_verification' NOT NULL,
  "contact_name" text NOT NULL,
  "organization" text,
  "email" text NOT NULL,
  "project_type" text NOT NULL,
  "budget_range" text NOT NULL,
  "timeline" text NOT NULL,
  "brief" text NOT NULL,
  "source_label" text DEFAULT 'public_intake' NOT NULL,
  "verified_at" timestamp with time zone,
  "retention_until" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "inquiries_status_check"
    CHECK ("inquiries"."status" in ('pending_verification', 'received', 'reviewing', 'accepted', 'declined', 'closed', 'expired')),
  CONSTRAINT "inquiries_contact_name_length_check"
    CHECK (char_length("inquiries"."contact_name") between 1 and 100),
  CONSTRAINT "inquiries_organization_length_check"
    CHECK ("inquiries"."organization" is null or char_length("inquiries"."organization") between 1 and 120),
  CONSTRAINT "inquiries_email_length_check"
    CHECK (char_length("inquiries"."email") between 3 and 254),
  CONSTRAINT "inquiries_brief_length_check"
    CHECK (char_length("inquiries"."brief") between 1 and 8000)
);
--> statement-breakpoint
CREATE TABLE "inquiry_links" (
  "id" text PRIMARY KEY NOT NULL,
  "inquiry_id" text NOT NULL,
  "position" integer NOT NULL,
  "url" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "inquiry_links_inquiry_position_key"
    UNIQUE("inquiry_id", "position"),
  CONSTRAINT "inquiry_links_inquiry_id_inquiries_id_fk"
    FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "inquiry_links_position_check"
    CHECK ("inquiry_links"."position" between 0 and 2),
  CONSTRAINT "inquiry_links_url_length_check"
    CHECK (char_length("inquiry_links"."url") between 1 and 2048)
);
--> statement-breakpoint
CREATE TABLE "outbox_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "message_key" text NOT NULL,
  "template" text NOT NULL,
  "recipient" text NOT NULL,
  "payload" jsonb NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "lease_owner" text,
  "lease_expires_at" timestamp with time zone,
  "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "outbox_messages_message_key_key" UNIQUE("message_key"),
  CONSTRAINT "outbox_messages_status_check"
    CHECK ("outbox_messages"."status" in ('pending', 'leased', 'sent', 'failed', 'cancelled')),
  CONSTRAINT "outbox_messages_attempts_check"
    CHECK ("outbox_messages"."attempts" between 0 and 4)
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
  "dimension" text NOT NULL,
  "bucket_hash" text NOT NULL,
  "window_started_at" timestamp with time zone NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  CONSTRAINT "rate_limit_buckets_pkey"
    PRIMARY KEY("dimension", "bucket_hash", "window_started_at"),
  CONSTRAINT "rate_limit_buckets_count_check"
    CHECK ("rate_limit_buckets"."count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
  "id" text PRIMARY KEY NOT NULL,
  "action_key" text NOT NULL,
  "actor_type" text NOT NULL,
  "action" text NOT NULL,
  "subject_type" text NOT NULL,
  "subject_id" text NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "audit_events_action_key_key" UNIQUE("action_key")
);
--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");
--> statement-breakpoint
CREATE INDEX "inquiries_status_created_at_idx" ON "inquiries" USING btree ("status", "created_at");
--> statement-breakpoint
CREATE INDEX "inquiry_links_inquiry_id_idx" ON "inquiry_links" USING btree ("inquiry_id");
--> statement-breakpoint
CREATE INDEX "outbox_messages_delivery_idx" ON "outbox_messages" USING btree ("status", "next_attempt_at");
--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_expiry_idx" ON "rate_limit_buckets" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX "audit_events_subject_timeline_idx" ON "audit_events" USING btree ("subject_type", "subject_id", "occurred_at");
