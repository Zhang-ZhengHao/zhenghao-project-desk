import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");

describe("repository trust copy", () => {
  it("states the implemented foundation and unfinished capabilities precisely", () => {
    const readme = readFileSync(resolve(projectRoot, "README.md"), "utf8");
    const design = readFileSync(
      resolve(projectRoot, "docs/design-summary.md"),
      "utf8",
    );
    const environmentExample = readFileSync(
      resolve(projectRoot, ".env.example"),
      "utf8",
    );
    const security = readFileSync(resolve(projectRoot, "SECURITY.md"), "utf8");
    const packageJson = JSON.parse(
      readFileSync(resolve(projectRoot, "package.json"), "utf8"),
    ) as { description?: string };

    expect(readme).toContain("Hosted foundation preview only.");
    expect(readme).toContain(
      "The fixed runtime boundary, PostgreSQL schema, checksum-pinned migration path, and liveness/readiness endpoints are implemented.",
    );
    expect(readme).toContain(
      "The public inquiry form, email delivery, and owner workspace are not available in this revision.",
    );
    expect(readme).toContain("receive a manual review status");
    expect(readme).not.toContain("Repository bootstrap only");
    expect(readme).not.toContain("receive an honest review status");
    expect(readme).toContain("## Implemented foundation");
    expect(readme).toContain("## Still planned for v0.1");
    expect(readme).toContain("Unused keys must be absent, not empty.");
    expect(readme).toContain("npm run db:migrate:primary");
    expect(readme).toContain("npm run db:migrate:demo");
    expect(readme).toContain("`/health` is a liveness endpoint");
    expect(readme).toContain("`/ready` returns `200`");
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
    expect(readme).not.toContain("production-ready");
    expect(design).toContain("primary_app");
    expect(design).toContain("primary_migrator");
    expect(design).toContain("demo_app");
    expect(design).toContain("demo_migrator");
    expect(design).toContain("exact committed migration journal");
    expect(environmentExample).toContain("APP_MODE=primary");
    expect(environmentExample).toContain(
      "PRIMARY_DATABASE_URL=postgresql://primary_app:replace-me@primary.db.invalid/project_desk_primary",
    );
    expect(environmentExample).not.toMatch(
      /^(?:DATABASE_URL|DEMO_DATABASE_URL|DEMO_MIGRATION_DATABASE_URL|PRIMARY_MIGRATION_DATABASE_URL)=/mu,
    );
    expect(security).toContain("hosted foundation preview");
    expect(security).not.toContain("repository is in bootstrap");
    expect(packageJson.description).toContain("Foundation preview");
    expect(packageJson.description).not.toMatch(/^Verified/u);
  });
});
