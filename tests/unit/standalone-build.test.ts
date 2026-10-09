import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

describe("Next.js deployment output", () => {
  it("builds a standalone server without the framework disclosure header", () => {
    expect(nextConfig.output).toBe("standalone");
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("marks the foundation preview as non-indexable and sends baseline security headers", async () => {
    const rules = await nextConfig.headers?.();
    const allHeaders = rules?.flatMap(({ headers }) => headers) ?? [];
    const valueFor = (key: string) =>
      allHeaders.find(
        (header) => header.key.toLowerCase() === key.toLowerCase(),
      )?.value;

    expect(valueFor("X-Robots-Tag")).toBe(
      "noindex, nofollow, noarchive, nosnippet",
    );
    expect(valueFor("X-Content-Type-Options")).toBe("nosniff");
    expect(valueFor("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(valueFor("Permissions-Policy")).toContain("camera=()");
  });
});
