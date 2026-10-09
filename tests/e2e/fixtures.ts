import { expect, test as base } from "@playwright/test";

type GuardFixtures = {
  errorGuard: void;
};

export const test = base.extend<GuardFixtures>({
  errorGuard: [
    async ({ page }, use) => {
      const browserErrors: string[] = [];

      page.on("console", (message) => {
        if (message.type() === "error") {
          browserErrors.push(`console.error: ${message.text()}`);
        }
      });

      page.on("pageerror", (error) => {
        browserErrors.push(`pageerror: ${error.message}`);
      });

      page.on("response", (response) => {
        const pathname = new URL(response.url()).pathname;
        if (response.status() >= 400 && pathname !== "/favicon.ico") {
          browserErrors.push(
            `${response.status()} ${response.request().method()} ${response.url()}`,
          );
        }
      });

      await use();

      expect(
        browserErrors,
        "browser console, page, and network errors",
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
