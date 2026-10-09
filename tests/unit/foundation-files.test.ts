import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");

describe("hosted foundation", () => {
  const requiredFiles = [
    "next.config.ts",
    "scripts/start-hosted.sh",
    "src/app/globals.css",
    "src/app/health/route.ts",
    "src/app/layout.tsx",
    "src/app/page.tsx",
    "src/domain/release.ts",
  ];

  for (const file of requiredFiles) {
    it(`includes ${file}`, () => {
      expect(existsSync(resolve(projectRoot, file))).toBe(true);
    });
  }
});
