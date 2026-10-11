interface ReadinessRepository {
  checkReadiness(): Promise<boolean>;
}

interface ReadinessRuntime {
  readonly mode: "demo" | "primary";
  readonly repository: ReadinessRepository;
}

type RuntimeLoader = () => Promise<ReadinessRuntime>;

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

export function createReadinessHandler(loadRuntime: RuntimeLoader) {
  return async function readinessHandler(request?: Request): Promise<Response> {
    void request;
    try {
      const runtime = await loadRuntime();
      const ready = await runtime.repository.checkReadiness();
      if (ready) {
        return Response.json(
          { status: "ready" },
          { headers: RESPONSE_HEADERS, status: 200 },
        );
      }
    } catch {
      // Readiness is deliberately non-diagnostic at the public boundary.
    }

    return Response.json(
      { status: "not_ready" },
      { headers: RESPONSE_HEADERS, status: 503 },
    );
  };
}
