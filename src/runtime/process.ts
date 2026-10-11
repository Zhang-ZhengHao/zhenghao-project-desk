import { createRuntimeContext } from "./index";

const startupEnvironment = Object.freeze({ ...process.env });
let runtimePromise: ReturnType<typeof createRuntimeContext> | undefined;

export function getProcessRuntimeContext() {
  runtimePromise ??= createRuntimeContext(startupEnvironment);
  return runtimePromise;
}
