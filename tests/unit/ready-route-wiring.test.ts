import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("GET /ready wiring", () => {
  it("fails closed when request input tries to supply a missing runtime mode", async () => {
    vi.stubEnv("APP_MODE", "invalid");
    const { GET } = await import("@/app/ready/route");

    const response = await GET(
      new Request("https://project-desk.invalid/ready?APP_MODE=primary", {
        headers: {
          cookie: "APP_MODE=primary",
          "x-app-mode": "primary",
        },
      }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "not_ready" });
  });
});
