import { z } from "zod";

import { RuntimeConfigurationError } from "./errors.ts";

export type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

export type RuntimeMode = "demo" | "primary";

const modeSchema = z.enum(["primary", "demo"]);

const databaseUrlSchema = z
  .string()
  .min(1)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        (url.protocol === "postgres:" || url.protocol === "postgresql:") &&
        url.hostname.length > 0 &&
        url.pathname.length > 1
      );
    } catch {
      return false;
    }
  });

export function readRuntimeMode(environment: RuntimeEnvironment): RuntimeMode {
  const result = modeSchema.safeParse(environment.APP_MODE);
  if (!result.success) {
    throw new RuntimeConfigurationError("invalid_app_mode");
  }
  return result.data;
}

export function rejectConfiguredKeys(
  environment: RuntimeEnvironment,
  forbiddenKeys: readonly string[],
): void {
  if (forbiddenKeys.some((key) => Object.hasOwn(environment, key))) {
    throw new RuntimeConfigurationError("mixed_runtime_credentials");
  }
}

export function readDatabaseUrl(
  environment: RuntimeEnvironment,
  key: string,
): string {
  const value = environment[key];
  if (value === undefined || value === "") {
    throw new RuntimeConfigurationError("missing_database_url");
  }

  const result = databaseUrlSchema.safeParse(value);
  if (!result.success) {
    throw new RuntimeConfigurationError("invalid_database_url");
  }
  return result.data;
}
