import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createSiteMetadata } from "@/config/site-metadata";

describe("public site metadata", () => {
  it("keeps the hosted foundation in explicit preview mode", () => {
    const metadata = createSiteMetadata();

    expect(metadata.title).toBe("Zhenghao Project Desk | Work in progress");
    expect(metadata.description).toBe(
      "A work-in-progress project intake portal for Zhenghao Zhang's independent full-stack development services. Project intake is not open yet.",
    );
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.metadataBase).toBeNull();
    expect(metadata.openGraph).not.toHaveProperty("images");
    expect(metadata.openGraph).not.toHaveProperty("url");
    expect(metadata.robots).toMatchObject({
      follow: false,
      index: false,
      noarchive: true,
      nosnippet: true,
    });
  });

  it("does not expose a release environment switch before intake exists", () => {
    const layoutSource = readFileSync(
      resolve(import.meta.dirname, "../../src/app/layout.tsx"),
      "utf8",
    );

    expect(layoutSource).not.toContain("PUBLIC_RELEASE");
    expect(layoutSource).not.toContain("PUBLIC_APP_ORIGIN");

    const metadata = Reflect.apply(createSiteMetadata, undefined, [
      "https://desk.example.com",
      true,
    ]);
    expect(metadata.robots).toMatchObject({ follow: false, index: false });
    expect(metadata.alternates).toBeUndefined();
  });
});
