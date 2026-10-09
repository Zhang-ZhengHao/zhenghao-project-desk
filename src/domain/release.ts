export interface ReleaseIdentity {
  commit: string;
  version: string;
}

type ReleaseEnvironment = Readonly<Record<string, string | undefined>>;

const SAFE_VERSION = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,31}$/;
const GIT_SHA = /^[0-9a-f]{7,40}$/i;

export function getReleaseIdentity(
  environment: ReleaseEnvironment = process.env,
): ReleaseIdentity {
  const configuredVersion = environment.APP_VERSION?.trim();
  const configuredCommit = environment.BUILD_SHA?.trim();

  return {
    commit:
      configuredCommit && GIT_SHA.test(configuredCommit)
        ? configuredCommit.toLowerCase().slice(0, 12)
        : "development",
    version:
      configuredVersion && SAFE_VERSION.test(configuredVersion)
        ? configuredVersion
        : "0.1.0-dev",
  };
}
