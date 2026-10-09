import { access, cp, rm } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = process.cwd();
const standaloneRoot = resolve(projectRoot, ".next/standalone");
const standaloneServer = resolve(standaloneRoot, "server.js");

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function replaceDirectory(source, destination) {
  await rm(destination, { force: true, recursive: true });
  await cp(source, destination, { force: true, recursive: true });
}

async function main() {
  if (!(await pathExists(standaloneServer))) {
    throw new Error(
      "Next standalone server is missing. Run next build before packaging.",
    );
  }

  await replaceDirectory(
    resolve(projectRoot, ".next/static"),
    resolve(standaloneRoot, ".next/static"),
  );

  const publicDirectory = resolve(projectRoot, "public");
  const packagedPublicDirectory = resolve(standaloneRoot, "public");

  if (await pathExists(publicDirectory)) {
    await replaceDirectory(publicDirectory, packagedPublicDirectory);
  } else {
    await rm(packagedPublicDirectory, { force: true, recursive: true });
  }
}

main().catch((error) => {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown standalone packaging failure.";
  console.error(message);
  process.exitCode = 1;
});
