import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");
const packagingScript = resolve(projectRoot, "scripts/package-standalone.mjs");
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function createBuildFixture() {
  const directory = mkdtempSync(join(tmpdir(), "project-desk-package-"));
  temporaryDirectories.push(directory);
  mkdirSync(join(directory, ".next/standalone"), { recursive: true });
  mkdirSync(join(directory, ".next/static/chunks"), { recursive: true });
  mkdirSync(join(directory, "public/images"), { recursive: true });
  writeFileSync(join(directory, ".next/standalone/server.js"), "// server\n");
  writeFileSync(join(directory, ".next/static/chunks/app.js"), "// static\n");
  writeFileSync(join(directory, "public/images/proof.png"), "proof\n");
  return directory;
}

function runPackaging(directory: string) {
  return spawnSync(process.execPath, [packagingScript], {
    cwd: directory,
    encoding: "utf8",
  });
}

describe("standalone deployment packaging", () => {
  it("fails clearly when the standalone server has not been built", () => {
    const directory = mkdtempSync(
      join(tmpdir(), "project-desk-package-missing-"),
    );
    temporaryDirectories.push(directory);

    const result = runPackaging(directory);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("standalone server is missing");
  });

  it("copies Next static assets and public evidence beside the standalone server", () => {
    const directory = createBuildFixture();

    const result = runPackaging(directory);

    expect(result.status).toBe(0);
    expect(
      readFileSync(
        join(directory, ".next/standalone/.next/static/chunks/app.js"),
        "utf8",
      ),
    ).toBe("// static\n");
    expect(
      readFileSync(
        join(directory, ".next/standalone/public/images/proof.png"),
        "utf8",
      ),
    ).toBe("proof\n");
  });

  it("removes stale packaged assets when run again", () => {
    const directory = createBuildFixture();
    expect(runPackaging(directory).status).toBe(0);
    writeFileSync(
      join(directory, ".next/standalone/public/stale.txt"),
      "stale\n",
    );

    expect(runPackaging(directory).status).toBe(0);

    expect(
      existsSync(join(directory, ".next/standalone/public/stale.txt")),
    ).toBe(false);
  });
});
