import { describe, expect, it, vi } from "vitest";

import { createReadinessHandler } from "@/readiness/handler";

function forgedRequest() {
  return new Request(
    "https://project-desk.invalid/ready?APP_MODE=demo&mode=demo",
    {
      headers: {
        cookie: "APP_MODE=demo; mode=demo",
        "x-app-mode": "demo",
        "x-runtime-mode": "demo",
      },
    },
  );
}

describe("readiness route", () => {
  it("returns a minimal non-cacheable success for the fixed runtime", async () => {
    const checkReadiness = vi.fn().mockResolvedValue(true);
    const handler = createReadinessHandler(async () => ({
      mode: "primary" as const,
      repository: { checkReadiness },
    }));

    const response = await handler(forgedRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "ready" });
    expect(checkReadiness).toHaveBeenCalledOnce();
  });

  it("returns 503 when the current database migration is not ready", async () => {
    const handler = createReadinessHandler(async () => ({
      mode: "demo" as const,
      repository: {
        checkReadiness: vi.fn().mockResolvedValue(false),
      },
    }));

    const response = await handler(forgedRequest());

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "not_ready" });
  });

  it("does not expose a database error or credential", async () => {
    const sensitiveValue =
      "postgresql://private_user:private_password@private.db.invalid/private";
    const handler = createReadinessHandler(async () => ({
      mode: "primary" as const,
      repository: {
        checkReadiness: vi
          .fn()
          .mockRejectedValue(new Error(`connection failed: ${sensitiveValue}`)),
      },
    }));

    const response = await handler(forgedRequest());
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).toBe('{"status":"not_ready"}');
    expect(body).not.toContain(sensitiveValue);
    expect(body).not.toContain("private_user");
  });
});
