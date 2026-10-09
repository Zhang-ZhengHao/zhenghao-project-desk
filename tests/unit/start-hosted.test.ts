import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");
const startScript = resolve(projectRoot, "scripts/start-hosted.sh");
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function runStart(environment: Record<string, string> = {}) {
  return spawnSync("bash", [startScript], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      NODE_ENV: "test",
      PATH: process.env.PATH,
      ...environment,
    },
  });
}

describe("hosted start contract", () => {
  it("fails clearly when PORT is missing", () => {
    const result = runStart();

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("PORT is required");
  });

  it.each(["abc", "0", "65536"])("rejects invalid PORT %s", (port) => {
    const result = runStart({ PORT: port });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "PORT must be an integer between 1 and 65535",
    );
  });

  it("binds the standalone server to 0.0.0.0 and the assigned port", () => {
    const fakeBin = mkdtempSync(join(tmpdir(), "project-desk-node-"));
    temporaryDirectories.push(fakeBin);
    const fakeNode = join(fakeBin, "node");
    writeFileSync(
      fakeNode,
      '#!/usr/bin/env bash\nprintf "host=%s port=%s entry=%s\\n" "$HOSTNAME" "$PORT" "$1"\n',
    );
    chmodSync(fakeNode, 0o755);

    const result = runStart({
      PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
      PORT: "43123",
    });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(
      "host=0.0.0.0 port=43123 entry=.next/standalone/server.js",
    );
  });
});
