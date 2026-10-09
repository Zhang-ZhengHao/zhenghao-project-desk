import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");
const runtimeScript = resolve(projectRoot, "scripts/setup-runtime.sh");
const runtimeScriptExists = existsSync(runtimeScript);
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function createFixture() {
  const directory = mkdtempSync(join(tmpdir(), "project-desk-runtime-"));
  temporaryDirectories.push(directory);
  mkdirSync(join(directory, "scripts"), { recursive: true });
  copyFileSync(runtimeScript, join(directory, "scripts/setup-runtime.sh"));
  chmodSync(join(directory, "scripts/setup-runtime.sh"), 0o755);
  writeFileSync(join(directory, "package.json"), '{"name":"fixture"}\n');
  writeFileSync(
    join(directory, "package-lock.json"),
    '{"lockfileVersion":3}\n',
  );
  writeFileSync(join(directory, ".npmrc"), "save-exact=true\n");

  const fakeBin = join(directory, "fake-bin");
  mkdirSync(fakeBin);
  const fakeNpm = join(fakeBin, "npm");
  writeFileSync(
    fakeNpm,
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$FAKE_NPM_LOG"
if [[ "\${1:-}" == "ci" ]]; then
  mkdir -p node_modules/.bin
  : > node_modules/.bin/next
elif [[ "\${1:-}" == "run" && "\${2:-}" == "build" ]]; then
  mkdir -p .next/standalone/.next/static
  : > .next/standalone/server.js
  if [[ "\${FAKE_INCOMPLETE_BUILD:-0}" != "1" ]]; then
    mkdir -p .next/standalone/public
  fi
fi
`,
  );
  chmodSync(fakeNpm, 0o755);

  return {
    directory,
    environment: {
      FAKE_NPM_LOG: join(directory, "npm.log"),
      PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
    },
  };
}

function runSetup(directory: string, environment: Record<string, string>) {
  return spawnSync("bash", [join(directory, "scripts/setup-runtime.sh")], {
    cwd: directory,
    encoding: "utf8",
    env: {
      NODE_ENV: "test",
      ...environment,
    },
  });
}

describe("runtime setup", () => {
  it("ships an executable runtime setup script", () => {
    expect(runtimeScriptExists).toBe(true);
    if (runtimeScriptExists) {
      expect(statSync(runtimeScript).mode & 0o111).not.toBe(0);
    }
  });

  it.skipIf(!runtimeScriptExists)(
    "installs locked dependencies and builds deployable output",
    () => {
      const fixture = createFixture();

      const result = runSetup(fixture.directory, fixture.environment);

      expect(result.status).toBe(0);
      expect(
        readFileSync(fixture.environment.FAKE_NPM_LOG, "utf8")
          .trim()
          .split("\n"),
      ).toEqual(["ci --ignore-scripts --no-audit --no-fund", "run build"]);
      expect(
        existsSync(join(fixture.directory, ".next/standalone/server.js")),
      ).toBe(true);
    },
  );

  it.skipIf(!runtimeScriptExists)(
    "reuses unchanged dependencies but rebuilds application output",
    () => {
      const fixture = createFixture();

      expect(runSetup(fixture.directory, fixture.environment).status).toBe(0);
      expect(runSetup(fixture.directory, fixture.environment).status).toBe(0);

      expect(
        readFileSync(fixture.environment.FAKE_NPM_LOG, "utf8")
          .trim()
          .split("\n"),
      ).toEqual([
        "ci --ignore-scripts --no-audit --no-fund",
        "run build",
        "run build",
      ]);
    },
  );

  it.skipIf(!runtimeScriptExists)(
    "fails when the packaged public directory is missing",
    () => {
      const fixture = createFixture();

      const result = runSetup(fixture.directory, {
        ...fixture.environment,
        FAKE_INCOMPLETE_BUILD: "1",
      });

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("standalone public assets are missing");
    },
  );
});
