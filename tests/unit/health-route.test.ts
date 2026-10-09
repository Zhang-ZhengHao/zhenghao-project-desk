import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/health/route";

describe("GET /health", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a non-cached release identity without internal details", async () => {
    vi.stubEnv("APP_VERSION", "0.1.0-dev");
    vi.stubEnv("BUILD_SHA", "abcdef0123456789abcdef0123456789abcdef01");

    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      release: {
        commit: "abcdef012345",
        version: "0.1.0-dev",
      },
      service: "zhenghao-project-desk",
      status: "ok",
    });
  });
});
