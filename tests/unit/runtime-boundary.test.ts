import { describe, expect, it } from "vitest";

import { RuntimeConfigurationError, createRuntimeContext } from "@/runtime";

const PRIMARY_URL =
  "postgresql://primary_app:synthetic@primary.db.invalid/project_desk_primary";
const DEMO_URL =
  "postgresql://demo_app:synthetic@demo.db.invalid/project_desk_demo";

describe("runtime boundary", () => {
  it("loads only the primary repository capability for primary mode", async () => {
    const runtime = await createRuntimeContext({
      APP_MODE: "primary",
      PRIMARY_DATABASE_URL: PRIMARY_URL,
    });

    expect(runtime.mode).toBe("primary");
    expect(runtime.repository.mode).toBe("primary");
    expect(runtime.repository.checkReadiness).toBeTypeOf("function");
    expect(runtime.repository.close).toBeTypeOf("function");
    expect("databaseUrl" in runtime.repository).toBe(false);
    expect("demoRepository" in runtime).toBe(false);
    expect(Object.isFrozen(runtime)).toBe(true);
  });

  it("loads only the demo repository capability for demo mode", async () => {
    const runtime = await createRuntimeContext({
      APP_MODE: "demo",
      DEMO_DATABASE_URL: DEMO_URL,
    });

    expect(runtime.mode).toBe("demo");
    expect(runtime.repository.mode).toBe("demo");
    expect(runtime.repository.checkReadiness).toBeTypeOf("function");
    expect(runtime.repository.close).toBeTypeOf("function");
    expect("databaseUrl" in runtime.repository).toBe(false);
    expect("primaryRepository" in runtime).toBe(false);
    expect(Object.isFrozen(runtime)).toBe(true);
  });

  it.each([undefined, "", "PRIMARY", "production", "demo "])(
    "fails closed before startup for APP_MODE=%s",
    async (mode) => {
      await expect(
        createRuntimeContext({
          APP_MODE: mode,
          DEMO_DATABASE_URL: DEMO_URL,
          PRIMARY_DATABASE_URL: PRIMARY_URL,
        }),
      ).rejects.toMatchObject({
        code: "invalid_app_mode",
      });
    },
  );

  it.each([
    "DEMO_DATABASE_URL",
    "DEMO_MIGRATION_DATABASE_URL",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "PRIMARY_MIGRATION_DATABASE_URL",
    "DATABASE_URL",
  ])("rejects %s in a primary web process even when empty", async (key) => {
    await expect(
      createRuntimeContext({
        APP_MODE: "primary",
        PRIMARY_DATABASE_URL: PRIMARY_URL,
        [key]: "",
      }),
    ).rejects.toMatchObject({
      code: "mixed_runtime_credentials",
    });
  });

  it.each([
    "PRIMARY_DATABASE_URL",
    "PRIMARY_MIGRATION_DATABASE_URL",
    "RESEND_API_KEY",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "OWNER_GITHUB_ID",
    "DEMO_MIGRATION_DATABASE_URL",
    "DATABASE_URL",
  ])("rejects %s in a demo web process even when empty", async (key) => {
    await expect(
      createRuntimeContext({
        APP_MODE: "demo",
        DEMO_DATABASE_URL: DEMO_URL,
        [key]: "",
      }),
    ).rejects.toMatchObject({
      code: "mixed_runtime_credentials",
    });
  });

  it.each([
    ["primary", "PRIMARY_DATABASE_URL"],
    ["demo", "DEMO_DATABASE_URL"],
  ] as const)("requires one valid PostgreSQL DSN for %s", async (mode, key) => {
    await expect(
      createRuntimeContext({ APP_MODE: mode }),
    ).rejects.toMatchObject({ code: "missing_database_url" });

    await expect(
      createRuntimeContext({ APP_MODE: mode, [key]: "https://db.invalid/x" }),
    ).rejects.toMatchObject({ code: "invalid_database_url" });
  });

  it("does not expose credential values in configuration failures", async () => {
    const secretValue =
      "postgresql://private_user:private_password@private.db.invalid/private_db";

    let failure: unknown;
    try {
      await createRuntimeContext({
        APP_MODE: "primary",
        PRIMARY_DATABASE_URL: secretValue,
        STRIPE_SECRET_KEY: "synthetic-stripe-secret",
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(RuntimeConfigurationError);
    expect(String(failure)).not.toContain(secretValue);
    expect(String(failure)).not.toContain("private_user");
    expect(String(failure)).not.toContain("private_password");
    expect(String(failure)).not.toContain("synthetic-stripe-secret");
  });

  it("keeps the startup mode fixed after the environment record changes", async () => {
    const environment: Record<string, string | undefined> = {
      APP_MODE: "primary",
      PRIMARY_DATABASE_URL: PRIMARY_URL,
    };
    const runtime = await createRuntimeContext(environment);

    environment.APP_MODE = "demo";
    environment.PRIMARY_DATABASE_URL = undefined;
    environment.DEMO_DATABASE_URL = DEMO_URL;

    expect(runtime.mode).toBe("primary");
    expect(runtime.repository.mode).toBe("primary");
  });
});
