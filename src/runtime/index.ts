import { readRuntimeMode, type RuntimeEnvironment } from "./environment";

import type { DemoRuntimeContext } from "./demo";
import type { PrimaryRuntimeContext } from "./primary";

export { RuntimeConfigurationError } from "./errors";

export type RuntimeContext = DemoRuntimeContext | PrimaryRuntimeContext;

export async function createRuntimeContext(
  environment: RuntimeEnvironment = process.env,
): Promise<RuntimeContext> {
  const mode = readRuntimeMode(environment);

  if (mode === "primary") {
    const { createPrimaryRuntime } = await import("./primary");
    return createPrimaryRuntime(environment);
  }

  const { createDemoRuntime } = await import("./demo");
  return createDemoRuntime(environment);
}
