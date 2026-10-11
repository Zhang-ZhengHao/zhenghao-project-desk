export type RuntimeConfigurationErrorCode =
  | "invalid_app_mode"
  | "invalid_database_url"
  | "migration_mode_mismatch"
  | "missing_database_url"
  | "mixed_runtime_credentials";

const SAFE_MESSAGES: Readonly<Record<RuntimeConfigurationErrorCode, string>> = {
  invalid_app_mode: "The application runtime mode is invalid.",
  invalid_database_url: "The configured database target is invalid.",
  migration_mode_mismatch:
    "The migration command does not match the configured runtime mode.",
  missing_database_url: "The current runtime database target is missing.",
  mixed_runtime_credentials:
    "Credentials for incompatible runtime capabilities were provided.",
};

export class RuntimeConfigurationError extends Error {
  readonly code: RuntimeConfigurationErrorCode;

  constructor(code: RuntimeConfigurationErrorCode) {
    super(SAFE_MESSAGES[code]);
    this.name = "RuntimeConfigurationError";
    this.code = code;
  }
}
