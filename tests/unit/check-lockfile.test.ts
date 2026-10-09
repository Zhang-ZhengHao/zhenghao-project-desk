import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");
const policyScript = resolve(projectRoot, "scripts/check-lockfile.mjs");
const temporaryDirectories: string[] = [];

type Manifest = {
  name: string;
  version: string;
  license: string;
  packageManager: string;
  engines: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

type LockPackage = Record<string, unknown>;

type Lockfile = {
  name: string;
  version: string;
  lockfileVersion: number;
  requires: boolean;
  packages: Record<string, LockPackage>;
};

function createManifest(): Manifest {
  return {
    name: "lockfile-policy-fixture",
    version: "1.0.0",
    license: "MIT",
    packageManager: "npm@11.19.0",
    engines: {
      node: ">=24.15.0 <25",
      npm: ">=11 <12",
    },
    dependencies: {
      "safe-dependency": "1.2.3",
    },
    devDependencies: {
      "safe-development-dependency": "4.5.6",
    },
  };
}

function registryPackage(version: string, license = "MIT"): LockPackage {
  return {
    version,
    resolved: `https://registry.npmjs.org/example/-/example-${version}.tgz`,
    integrity: "sha512-YWJjZA==",
    license,
  };
}

function createLockfile(manifest: Manifest): Lockfile {
  return {
    name: manifest.name,
    version: manifest.version,
    lockfileVersion: 3,
    requires: true,
    packages: {
      "": {
        name: manifest.name,
        version: manifest.version,
        license: manifest.license,
        engines: manifest.engines,
        dependencies: manifest.dependencies,
        devDependencies: manifest.devDependencies,
      },
      "node_modules/safe-dependency": registryPackage("1.2.3"),
      "node_modules/safe-development-dependency": {
        ...registryPackage("4.5.6", "Apache-2.0"),
        dev: true,
      },
    },
  };
}

function createFixture(
  mutate?: (fixture: {
    manifest: Manifest;
    lockfile: Lockfile;
    npmrc: { value: string };
  }) => void,
) {
  const directory = mkdtempSync(join(tmpdir(), "project-desk-lockfile-"));
  temporaryDirectories.push(directory);

  const manifest = createManifest();
  const lockfile = createLockfile(manifest);
  const npmrc = {
    value: "save-exact=true\nengine-strict=true\nignore-scripts=true\n",
  };
  mutate?.({ manifest, lockfile, npmrc });

  writeFileSync(
    join(directory, "package.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  writeFileSync(
    join(directory, "package-lock.json"),
    `${JSON.stringify(lockfile, null, 2)}\n`,
  );
  writeFileSync(join(directory, ".npmrc"), npmrc.value);
  return directory;
}

function runPolicy(directory: string) {
  return spawnSync(process.execPath, [policyScript], {
    cwd: directory,
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("lockfile policy fixture", () => {
  it("accepts a locked npm tree with exact metadata and safe sources", () => {
    const result = runPolicy(createFixture());

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("requires npm lockfile version 3 with requires enabled", () => {
    const result = runPolicy(
      createFixture(({ lockfile }) => {
        lockfile.lockfileVersion = 2;
        lockfile.requires = false;
      }),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("lockfileVersion must be 3");
    expect(result.stderr).toContain("requires must be true");
  });

  it("rejects drift between the manifest and root lock package", () => {
    const result = runPolicy(
      createFixture(({ lockfile }) => {
        lockfile.name = "drifted-top-level-name";
        lockfile.packages[""] = {
          ...lockfile.packages[""],
          name: "drifted-root-name",
          dependencies: { "different-dependency": "9.9.9" },
        };
      }),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "top-level name does not match package.json",
    );
    expect(result.stderr).toContain("root name does not match package.json");
    expect(result.stderr).toContain(
      "root dependencies do not match package.json",
    );
  });

  it("requires an exact npm packageManager and exact direct dependency versions", () => {
    const result = runPolicy(
      createFixture(({ manifest, lockfile }) => {
        manifest.packageManager = "npm@11";
        manifest.dependencies["safe-dependency"] = "^1.2.3";
        lockfile.packages[""].dependencies = manifest.dependencies;
      }),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "packageManager must pin npm to an exact version",
    );
    expect(result.stderr).toContain(
      "direct dependency versions must be exact SemVer",
    );
  });

  it.each([
    ["git source", "git+https://github.com/example/package.git"],
    ["file source", "file:../package"],
    ["external registry", "https://packages.example.test/package.tgz"],
    [
      "credentialed registry URL",
      "https://user:TOP_SECRET@registry.npmjs.org/package.tgz",
    ],
    [
      "registry URL with query",
      "https://registry.npmjs.org/package.tgz?token=TOP_SECRET",
    ],
  ])("rejects a %s", (_description, resolved) => {
    const result = runPolicy(
      createFixture(({ lockfile }) => {
        lockfile.packages["node_modules/safe-dependency"].resolved = resolved;
      }),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "must resolve from the public npm registry",
    );
    expect(result.stderr).not.toContain("TOP_SECRET");
    expect(result.stderr).not.toContain(resolved);
  });

  it("rejects missing registry provenance without printing package metadata values", () => {
    const leakedIntegrity = "sha1-SENSITIVE_INTEGRITY_VALUE";
    const result = runPolicy(
      createFixture(({ lockfile }) => {
        const dependency = lockfile.packages["node_modules/safe-dependency"];
        delete dependency.resolved;
        dependency.integrity = leakedIntegrity;
      }),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "must resolve from the public npm registry",
    );
    expect(result.stderr).toContain("must use sha512 integrity");
    expect(result.stderr).not.toContain(leakedIntegrity);
  });

  it("rejects linked packages", () => {
    const result = runPolicy(
      createFixture(({ lockfile }) => {
        lockfile.packages["node_modules/safe-dependency"].link = true;
      }),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("linked packages are not allowed");
  });

  it("rejects install scripts except optional fsevents 2.3.3", () => {
    const rejected = runPolicy(
      createFixture(({ lockfile }) => {
        lockfile.packages["node_modules/safe-dependency"].hasInstallScript =
          true;
      }),
    );
    const accepted = runPolicy(
      createFixture(({ lockfile }) => {
        lockfile.packages["node_modules/fsevents"] = {
          ...registryPackage("2.3.3"),
          optional: true,
          hasInstallScript: true,
        };
      }),
    );

    expect(rejected.status).not.toBe(0);
    expect(rejected.stderr).toContain("install scripts are not allowed");
    expect(accepted.status).toBe(0);
  });

  it("rejects a changed or non-optional fsevents install-script exception", () => {
    const result = runPolicy(
      createFixture(({ lockfile }) => {
        lockfile.packages["node_modules/fsevents"] = {
          ...registryPackage("2.3.4"),
          optional: false,
          hasInstallScript: true,
        };
      }),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("install scripts are not allowed");
  });

  it("does not extend the fsevents exception to a nested package path", () => {
    const result = runPolicy(
      createFixture(({ lockfile }) => {
        lockfile.packages["node_modules/wrapper/node_modules/fsevents"] = {
          ...registryPackage("2.3.3"),
          optional: true,
          hasInstallScript: true,
        };
      }),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("install scripts are not allowed");
  });

  it("accepts the reviewed package-specific license exceptions", () => {
    const result = runPolicy(
      createFixture(({ lockfile }) => {
        lockfile.packages["node_modules/geist"] = {
          ...registryPackage("1.7.2", "SIL OPEN FONT LICENSE"),
        };
        lockfile.packages["node_modules/caniuse-lite"] = {
          ...registryPackage("1.0.30001780", "CC-BY-4.0"),
        };
        lockfile.packages["node_modules/@img/sharp-libvips-linux-x64"] = {
          ...registryPackage("1.2.4", "LGPL-3.0-or-later"),
          optional: true,
        };
        lockfile.packages["node_modules/@img/sharp-wasm32"] = {
          ...registryPackage(
            "0.34.5",
            "Apache-2.0 AND LGPL-3.0-or-later AND MIT",
          ),
          optional: true,
        };
        lockfile.packages["node_modules/@img/sharp-win32-x64"] = {
          ...registryPackage("0.34.5", "Apache-2.0 AND LGPL-3.0-or-later"),
          optional: true,
        };
      }),
    );

    expect(result.status).toBe(0);
  });

  it.each([
    "",
    "GPL-3.0-only",
    "AGPL-3.0-only",
    "SSPL-1.0",
    "Unknown-Proprietary",
  ])("rejects the unapproved license %j", (license) => {
    const result = runPolicy(
      createFixture(({ lockfile }) => {
        if (license === "") {
          delete lockfile.packages["node_modules/safe-dependency"].license;
        } else {
          lockfile.packages["node_modules/safe-dependency"].license = license;
        }
      }),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("license is not approved");
  });

  it("requires reviewed license exceptions to remain optional where specified", () => {
    const result = runPolicy(
      createFixture(({ lockfile }) => {
        lockfile.packages["node_modules/@img/sharp-libvips-linux-x64"] = {
          ...registryPackage("1.2.4", "LGPL-3.0-or-later"),
          optional: false,
        };
      }),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("license is not approved");
  });

  it("requires the three hardened npm settings", () => {
    const result = runPolicy(
      createFixture(({ npmrc }) => {
        npmrc.value = "save-exact=true\nengine-strict=false\n";
      }),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("engine-strict must be true");
    expect(result.stderr).toContain("ignore-scripts must be true");
  });

  it("rejects registry, authentication, proxy, script-shell, and unknown npmrc settings safely", () => {
    const npmToken = "NPM_TOKEN_SHOULD_NOT_LEAK";
    const registrySecret = "REGISTRY_PASSWORD_SHOULD_NOT_LEAK";
    const result = runPolicy(
      createFixture(({ npmrc }) => {
        npmrc.value = [
          "save-exact=true",
          "engine-strict=true",
          "ignore-scripts=true",
          `//registry.npmjs.org/:_authToken=${npmToken}`,
          `registry=https://user:${registrySecret}@registry.example.test/`,
          "proxy=http://proxy.example.test/",
          "script-shell=/bin/custom-shell",
          "unexpected-setting=value",
          "",
        ].join("\n");
      }),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      ".npmrc contains a setting that is not allowed",
    );
    expect(result.stderr).not.toContain(npmToken);
    expect(result.stderr).not.toContain(registrySecret);
    expect(result.stderr).not.toContain("registry.example.test");
  });
});

describe("current repository lockfile policy", () => {
  it("keeps the checked-in dependency tree within policy", () => {
    const result = runPolicy(projectRoot);

    expect(result.status, result.stderr).toBe(0);
    expect(
      readFileSync(resolve(projectRoot, "package-lock.json"), "utf8"),
    ).not.toBe("");
  });
});
