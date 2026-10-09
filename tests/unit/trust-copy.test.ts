import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");

describe("repository trust copy", () => {
  it("states the implemented foundation and unfinished capabilities precisely", () => {
    const readme = readFileSync(resolve(projectRoot, "README.md"), "utf8");
    const security = readFileSync(resolve(projectRoot, "SECURITY.md"), "utf8");
    const packageJson = JSON.parse(
      readFileSync(resolve(projectRoot, "package.json"), "utf8"),
    ) as { description?: string };

    expect(readme).toContain("Hosted foundation preview only.");
    expect(readme).toContain(
      "project intake, PostgreSQL persistence, email verification, and owner authentication are not available in this revision",
    );
    expect(readme).toContain("receive a manual review status");
    expect(readme).not.toContain("Repository bootstrap only");
    expect(readme).not.toContain("receive an honest review status");
    expect(readme).toContain("## Implemented foundation");
    expect(readme).toContain("## Still planned for v0.1");
    expect(readme).toContain(
      "Operational records, fixtures, and test identities use synthetic data.",
    );
    expect(readme).toContain(
      "Public developer-profile branding may appear in referenced portfolio screenshots.",
    );
    expect(readme).toContain(
      "source repositories' asset-specific rights notices",
    );
    expect(readme).not.toContain(
      "Screenshots, fixtures, and test identities will use synthetic data only.",
    );
    expect(readme).not.toContain("## Planned v0.1 evidence");
    expect(security).toContain("hosted foundation preview");
    expect(security).not.toContain("repository is in bootstrap");
    expect(packageJson.description).toContain("Foundation preview");
    expect(packageJson.description).not.toMatch(/^Verified/u);
  });
});
