import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");

function readProjectFile(relativePath: string) {
  return readFileSync(resolve(projectRoot, relativePath), "utf8");
}

describe("delivery configuration", () => {
  it("packages only the standalone application into a non-root runtime image", () => {
    const dockerfilePath = resolve(projectRoot, "Dockerfile");
    expect(existsSync(dockerfilePath)).toBe(true);

    const dockerfile = readProjectFile("Dockerfile");
    expect(dockerfile).toContain("node:24.20.0-bookworm-slim");
    expect(dockerfile).toMatch(/FROM node:24\.20\.0-bookworm-slim AS runtime/u);
    expect(dockerfile).toContain("/app/.next/standalone");
    expect(dockerfile).toContain("USER 10001:10001");
    expect(dockerfile).toContain('CMD ["node", "server.js"]');

    const runtimeStage = dockerfile.split(
      "FROM node:24.20.0-bookworm-slim AS runtime",
    )[1];
    expect(runtimeStage).toBeDefined();
    expect(runtimeStage).toContain(
      "apt-get upgrade -y --no-install-recommends",
    );
    expect(runtimeStage).toContain("/usr/local/lib/node_modules/npm");
    expect(runtimeStage).not.toContain("npm ci");
    expect(runtimeStage).not.toMatch(/COPY\s+\.\s+\./u);
  });

  it("keeps local and secret-bearing files out of the Docker build context", () => {
    const dockerignore = readProjectFile(".dockerignore");

    for (const entry of [
      ".git",
      ".next",
      "node_modules",
      ".env*",
      "playwright-report",
      "test-results",
    ]) {
      expect(dockerignore).toContain(entry);
    }
  });

  it("pins CI actions and exposes a stable aggregate gate", () => {
    const workflow = readProjectFile(".github/workflows/verify.yml");
    const publicHistoryJob = workflow
      .split("\n  supply_chain:")[0]
      ?.split("\n  public_history:")[1];

    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain("persist-credentials: false");
    expect(publicHistoryJob).toBeDefined();
    expect(publicHistoryJob).toContain("fetch-depth: 0");
    expect(publicHistoryJob).toContain(
      "ref: ${{ github.event.pull_request.head.sha || github.sha }}",
    );
    expect(workflow).toContain(
      "actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803",
    );
    expect(workflow).toContain(
      "actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38",
    );
    expect(workflow).toContain(
      "actions/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f",
    );
    expect(workflow).toContain(
      "aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25",
    );
    expect(workflow).toMatch(/\n {2}gate:\n/u);
    expect(workflow).toContain("if: always()");
    expect(workflow).not.toContain("pull_request_target");
    expect(workflow).not.toContain("dependency-review-action");
    expect(workflow).not.toContain("github/codeql-action");
  });

  it("installs the locked tree before auditing registry signatures", () => {
    const workflow = readProjectFile(".github/workflows/verify.yml");
    const supplyChainJob = workflow
      .split("\n  quality:")[0]
      ?.split("\n  supply_chain:")[1];

    expect(supplyChainJob).toBeDefined();
    expect(supplyChainJob).toContain(
      "run: npm ci --ignore-scripts --no-audit --no-fund",
    );
    expect(supplyChainJob).toContain("run: npm audit signatures");

    const policyIndex =
      supplyChainJob?.indexOf("run: npm run check:lockfile") ?? -1;
    const installIndex = supplyChainJob?.indexOf("run: npm ci") ?? -1;
    const signatureIndex =
      supplyChainJob?.indexOf("run: npm audit signatures") ?? -1;
    expect(policyIndex).toBeGreaterThan(-1);
    expect(installIndex).toBeGreaterThan(policyIndex);
    expect(signatureIndex).toBeGreaterThan(installIndex);
  });

  it("smoke-tests a hardened container and both browser viewports in CI", () => {
    const workflow = readProjectFile(".github/workflows/verify.yml");

    expect(workflow).toContain("--read-only");
    expect(workflow).toContain("--cap-drop=ALL");
    expect(workflow).toContain("no-new-privileges");
    expect(workflow).toContain("id -u");
    expect(workflow).toContain("/health");
    expect(workflow).toContain("npm run test:e2e");
    expect(workflow).toContain("npx playwright install --with-deps chromium");
  });

  it("configures bounded weekly updates for npm and GitHub Actions", () => {
    const dependabot = readProjectFile(".github/dependabot.yml");

    expect(dependabot).toContain('package-ecosystem: "npm"');
    expect(dependabot).toContain('package-ecosystem: "github-actions"');
    expect(dependabot).toMatch(/interval: "weekly"/u);
    expect(dependabot).toMatch(/open-pull-requests-limit: [1-9]/u);
  });

  it("provides deterministic local commands for security checks", () => {
    const packageJson = JSON.parse(readProjectFile("package.json")) as {
      license?: string;
      scripts?: Record<string, string>;
    };

    expect(packageJson.license).toBe("MIT");
    expect(packageJson.scripts?.["scan:public"]).toBe(
      "bash scripts/scan-public-history.sh",
    );
    expect(packageJson.scripts?.["check:lockfile"]).toBe(
      "node scripts/check-lockfile.mjs",
    );
  });
});
