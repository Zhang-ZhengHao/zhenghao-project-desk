import { createReadinessHandler } from "@/readiness/handler";
import { getProcessRuntimeContext } from "@/runtime/process";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = createReadinessHandler(getProcessRuntimeContext);
