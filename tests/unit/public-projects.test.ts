import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { publicProjects } from "@/config/public-projects";

const projectRoot = resolve(import.meta.dirname, "../..");

describe("public project evidence", () => {
  it("contains exactly three unique public GitHub repositories", () => {
    expect(publicProjects).toHaveLength(3);

    const urls = publicProjects.map(({ repositoryUrl }) => repositoryUrl);
    expect(new Set(urls)).toHaveLength(3);

    for (const repositoryUrl of urls) {
      const url = new URL(repositoryUrl);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe("github.com");
      expect(url.pathname).toMatch(/^\/Zhang-ZhengHao\/[a-z0-9-]+$/u);
    }
  });

  it("backs every project with a local repository screenshot", () => {
    for (const project of publicProjects) {
      expect(project.image.src).toMatch(
        /^\/images\/projects\/[a-z0-9-]+\.png$/u,
      );
      expect(project.image.alt.length).toBeGreaterThan(40);
      expect(
        existsSync(resolve(projectRoot, `public${project.image.src}`)),
      ).toBe(true);
    }
  });

  it("labels evidence boundaries without fabricated outcomes", () => {
    expect(publicProjects.map(({ evidenceLabel }) => evidenceLabel)).toEqual([
      "Synthetic data",
      "Synthetic data",
      "Self-initiated concept",
    ]);

    const combinedCopy = JSON.stringify(publicProjects);
    expect(combinedCopy).not.toMatch(
      /trusted by|client results|revenue|conversion rate|production-ready|guaranteed/i,
    );
    expect(combinedCopy).not.toMatch(/[—–]/u);
    expect(combinedCopy).not.toMatch(
      /audited actions|formula-safe exports|role-aware workflows/i,
    );
    expect(combinedCopy).toContain("an action audit trail");
    expect(combinedCopy).toContain("SQLite demo / PostgreSQL CI");
    expect(combinedCopy).toContain("formula-like cells escaped on export");
    expect(combinedCopy).toContain("offline processing by default");
    expect(combinedCopy).toContain("role-oriented interface flows");
  });
});
