import { describe, expect, it } from "vitest";

import { getReleaseIdentity } from "@/domain/release";

describe("getReleaseIdentity", () => {
  it("normalizes a configured release version and commit SHA", () => {
    expect(
      getReleaseIdentity({
        APP_VERSION: " 0.1.0 ",
        BUILD_SHA: "ABCDEF0123456789ABCDEF0123456789ABCDEF01",
      }),
    ).toEqual({
      commit: "abcdef012345",
      version: "0.1.0",
    });
  });

  it("uses explicit development values when release input is absent", () => {
    expect(getReleaseIdentity({})).toEqual({
      commit: "development",
      version: "0.1.0-dev",
    });
  });

  it("does not expose an arbitrary build identifier", () => {
    expect(
      getReleaseIdentity({
        APP_VERSION: "0.1.0-dev",
        BUILD_SHA: "customer-name-or-secret",
      }).commit,
    ).toBe("development");
  });

  it("does not expose an unsafe version value", () => {
    expect(
      getReleaseIdentity({
        APP_VERSION: "client@example.com internal release",
      }).version,
    ).toBe("0.1.0-dev");
  });
});
