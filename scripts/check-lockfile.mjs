#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { URL } from "node:url";
import { isDeepStrictEqual } from "node:util";

const allowedLicenses = new Set([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BlueOak-1.0.0",
  "CC0-1.0",
  "ISC",
  "MIT",
  "MIT-0",
  "MPL-2.0",
]);
const requiredNpmSettings = ["save-exact", "engine-strict", "ignore-scripts"];
const exactSemver =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const sha512Integrity = /^sha512-[A-Za-z0-9+/]+={0,2}$/;
const errors = [];

function addError(message) {
  errors.push(message);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readJson(filename) {
  try {
    const value = JSON.parse(
      readFileSync(resolve(process.cwd(), filename), "utf8"),
    );
    if (!isRecord(value)) {
      addError(`${filename} must contain a JSON object`);
      return null;
    }
    return value;
  } catch {
    addError(`${filename} must exist and contain valid JSON`);
    return null;
  }
}

function readNpmrc() {
  try {
    return readFileSync(resolve(process.cwd(), ".npmrc"), "utf8");
  } catch {
    addError(".npmrc must exist");
    return null;
  }
}

function packageLabel(lockPath) {
  const safe = lockPath.replace(/[^A-Za-z0-9@._/-]/g, "?").slice(0, 160);
  return safe || "an unnamed lockfile package";
}

function packageName(lockPath) {
  const marker = "node_modules/";
  const markerIndex = lockPath.lastIndexOf(marker);
  const relativeName =
    markerIndex === -1 ? lockPath : lockPath.slice(markerIndex + marker.length);
  const parts = relativeName.split("/");
  return relativeName.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

function hasSafeRegistrySource(resolved) {
  if (
    typeof resolved !== "string" ||
    !resolved.startsWith("https://registry.npmjs.org/")
  ) {
    return false;
  }

  try {
    const url = new URL(resolved);
    return (
      url.protocol === "https:" &&
      url.hostname === "registry.npmjs.org" &&
      url.port === "" &&
      url.username === "" &&
      url.password === "" &&
      url.search === "" &&
      url.hash === "" &&
      url.pathname.startsWith("/") &&
      url.pathname.length > 1
    );
  } catch {
    return false;
  }
}

function hasApprovedLicense(name, entry) {
  if (typeof entry.license === "string" && allowedLicenses.has(entry.license)) {
    return true;
  }
  if (name === "geist") {
    return entry.license === "SIL OPEN FONT LICENSE";
  }
  if (name === "caniuse-lite") {
    return entry.license === "CC-BY-4.0";
  }
  if (name.startsWith("@img/sharp-libvips-")) {
    return entry.license === "LGPL-3.0-or-later" && entry.optional === true;
  }
  if (name === "@img/sharp-wasm32") {
    return (
      entry.license === "Apache-2.0 AND LGPL-3.0-or-later AND MIT" &&
      entry.optional === true
    );
  }
  if (name.startsWith("@img/sharp-win32-")) {
    return (
      entry.license === "Apache-2.0 AND LGPL-3.0-or-later" &&
      entry.optional === true
    );
  }
  return false;
}

function isReviewedInstallScript(lockPath, entry) {
  return (
    lockPath === "node_modules/fsevents" &&
    entry.version === "2.3.3" &&
    entry.optional === true
  );
}

function validateExactDependencies(manifest) {
  let valid = true;
  for (const field of ["dependencies", "devDependencies"]) {
    const dependencies = manifest[field];
    if (!isRecord(dependencies)) {
      valid = false;
      continue;
    }
    if (
      Object.values(dependencies).some((version) => !exactSemver.test(version))
    ) {
      valid = false;
    }
  }
  if (!valid) {
    addError("direct dependency versions must be exact SemVer");
  }
}

function validateManifest(manifest) {
  if (
    !/^npm@(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(
      manifest.packageManager,
    )
  ) {
    addError("packageManager must pin npm to an exact version");
  }
  if (manifest.license !== "MIT") {
    addError("package.json license must be MIT");
  }
  validateExactDependencies(manifest);
}

function validateRootPackage(manifest, lockfile) {
  if (lockfile.lockfileVersion !== 3) {
    addError("lockfileVersion must be 3");
  }
  if (lockfile.requires !== true) {
    addError("requires must be true");
  }
  for (const field of ["name", "version"]) {
    if (!isDeepStrictEqual(lockfile[field], manifest[field])) {
      addError(`top-level ${field} does not match package.json`);
    }
  }
  if (!isRecord(lockfile.packages)) {
    addError("package-lock.json packages must be an object");
    return;
  }

  const rootPackage = lockfile.packages[""];
  if (!isRecord(rootPackage)) {
    addError("package-lock.json must contain a root package");
    return;
  }
  for (const field of [
    "name",
    "version",
    "license",
    "engines",
    "dependencies",
    "devDependencies",
  ]) {
    if (!isDeepStrictEqual(rootPackage[field], manifest[field])) {
      const verb = ["engines", "dependencies", "devDependencies"].includes(
        field,
      )
        ? "do"
        : "does";
      addError(`root ${field} ${verb} not match package.json`);
    }
  }
}

function validateLockedPackages(lockfile) {
  if (!isRecord(lockfile.packages)) {
    return;
  }

  for (const [lockPath, entry] of Object.entries(lockfile.packages)) {
    if (lockPath === "") {
      continue;
    }
    const label = packageLabel(lockPath);
    if (!isRecord(entry)) {
      addError(`${label}: lockfile package metadata must be an object`);
      continue;
    }
    const name = packageName(lockPath);

    if (!hasSafeRegistrySource(entry.resolved)) {
      addError(`${label}: must resolve from the public npm registry`);
    }
    if (
      typeof entry.integrity !== "string" ||
      !sha512Integrity.test(entry.integrity)
    ) {
      addError(`${label}: must use sha512 integrity`);
    }
    if (entry.link === true) {
      addError(`${label}: linked packages are not allowed`);
    }
    if (
      entry.hasInstallScript !== undefined &&
      entry.hasInstallScript !== false &&
      !isReviewedInstallScript(lockPath, entry)
    ) {
      addError(`${label}: install scripts are not allowed`);
    }
    if (!hasApprovedLicense(name, entry)) {
      addError(`${label}: license is not approved`);
    }
  }
}

function validateNpmrc(npmrc) {
  if (npmrc === null) {
    return;
  }

  const seen = new Set();
  for (const rawLine of npmrc.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#") || line.startsWith(";")) {
      continue;
    }
    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) {
      addError(".npmrc contains a setting that is not allowed");
      continue;
    }
    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim();
    if (!requiredNpmSettings.includes(key)) {
      addError(".npmrc contains a setting that is not allowed");
      continue;
    }
    seen.add(key);
    if (value !== "true") {
      addError(`${key} must be true`);
    }
  }

  for (const key of requiredNpmSettings) {
    if (!seen.has(key)) {
      addError(`${key} must be true`);
    }
  }
}

function main() {
  const manifest = readJson("package.json");
  const lockfile = readJson("package-lock.json");
  const npmrc = readNpmrc();

  if (manifest !== null) {
    validateManifest(manifest);
  }
  if (manifest !== null && lockfile !== null) {
    validateRootPackage(manifest, lockfile);
  }
  if (lockfile !== null) {
    validateLockedPackages(lockfile);
  }
  validateNpmrc(npmrc);

  if (errors.length > 0) {
    process.stderr.write(
      `Lockfile policy check failed:\n${[...new Set(errors)].map((error) => `- ${error}`).join("\n")}\n`,
    );
    process.exitCode = 1;
    return;
  }
  process.stdout.write("Lockfile policy check passed.\n");
}

try {
  main();
} catch {
  process.stderr.write("Lockfile policy check failed unexpectedly.\n");
  process.exitCode = 1;
}
