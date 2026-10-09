import { getViolations, injectAxe } from "axe-playwright";

import { expect, test } from "./fixtures";

test.describe("hosted foundation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders an honest first viewport without unfinished routes", async ({
    page,
  }) => {
    const heading = page.getByRole("heading", {
      level: 1,
      name: "Full-stack tools for business workflows.",
    });
    await expect(heading).toBeVisible();

    const headingMetrics = await heading.evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        height: element.getBoundingClientRect().height,
        lineHeight: Number.parseFloat(styles.lineHeight),
      };
    });
    const currentViewport = page.viewportSize();
    const maximumLines = (currentViewport?.width ?? 0) < 768 ? 3.15 : 2.15;
    expect(
      headingMetrics.height / headingMetrics.lineHeight,
    ).toBeLessThanOrEqual(maximumLines);
    await expect
      .poll(() =>
        heading.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
      )
      .toBe(true);

    const selectedWork = page.getByRole("link", { name: "View selected work" });
    await expect(selectedWork).toBeVisible();
    const box = await selectedWork.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
      viewport?.height ?? 0,
    );

    await expect(
      page.getByText("Work in progress: project intake is not open yet."),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Project intake" }),
    ).toBeVisible();
    await expect(page.locator('a[href="/start"]')).toHaveCount(0);
    await expect(page.locator('a[href="/demo"]')).toHaveCount(0);
  });

  test("loads public evidence and every local visual asset", async ({
    page,
  }) => {
    const work = page.getByRole("region", { name: "Selected work" });
    await work.scrollIntoViewIfNeeded();
    await expect(work.getByRole("article")).toHaveCount(3);

    const repositoryLinks = work.getByRole("link", { name: "View repository" });
    await expect(repositoryLinks).toHaveCount(3);

    for (let index = 0; index < 3; index += 1) {
      const link = repositoryLinks.nth(index);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
      await expect(link).toHaveAttribute(
        "href",
        /^https:\/\/github\.com\/Zhang-ZhengHao\//u,
      );
    }

    const projectImages = work.locator("img");
    const viewport = page.viewportSize();
    for (let index = 0; index < 3; index += 1) {
      const image = projectImages.nth(index);
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          image.evaluate(
            (element) =>
              element instanceof HTMLImageElement &&
              element.complete &&
              element.naturalWidth > 0,
          ),
        )
        .toBe(true);

      if ((viewport?.width ?? 0) <= 700) {
        const ratios = await image.evaluate((element) => {
          const imageElement = element as HTMLImageElement;
          return {
            natural: imageElement.naturalWidth / imageElement.naturalHeight,
            rendered:
              imageElement.getBoundingClientRect().width /
              imageElement.getBoundingClientRect().height,
          };
        });
        expect(Math.abs(ratios.natural - ratios.rendered)).toBeLessThan(0.03);
      }
    }

    const stylesheetUrls = await page
      .locator('link[rel="stylesheet"]')
      .evaluateAll((links) =>
        links.map((link) => (link as HTMLLinkElement).href),
      );
    expect(stylesheetUrls.length).toBeGreaterThan(0);

    for (const url of stylesheetUrls) {
      const response = await page.request.get(url);
      expect(response.status(), `stylesheet ${url}`).toBe(200);
    }
  });

  test("has no horizontal overflow", async ({ page }) => {
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  });

  test("moves keyboard focus from the skip link into main content", async ({
    page,
  }) => {
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();

    await page.keyboard.press("Tab");
    const firstMainAction = page.getByRole("link", {
      name: "View selected work",
    });
    await expect(firstMainAction).toBeFocused();
    const outlineWidth = await firstMainAction.evaluate(
      (element) => getComputedStyle(element).outlineWidth,
    );
    expect(outlineWidth).not.toBe("0px");
  });

  test("honors reduced motion and the system dark theme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.reload();

    const styles = await page.evaluate(() => ({
      background: getComputedStyle(document.body).backgroundColor,
      color: getComputedStyle(document.body).color,
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    }));

    expect(styles.background).toBe("rgb(12, 20, 27)");
    expect(styles.color).toBe("rgb(237, 243, 246)");
    expect(styles.scrollBehavior).toBe("auto");
  });

  test("has no detectable WCAG A or AA violations", async ({ page }) => {
    await injectAxe(page);
    const violations = await getViolations(page, undefined, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21aa"],
      },
    });

    expect(
      violations.map(({ help, id, impact, nodes }) => ({
        help,
        id,
        impact,
        nodes: nodes.map(({ target }) => target),
      })),
    ).toEqual([]);
  });

  test("serves preview and health headers from the production process", async ({
    page,
  }) => {
    const landing = await page.request.get("/");
    expect(landing.status()).toBe(200);
    expect(landing.headers()["x-robots-tag"]).toBe(
      "noindex, nofollow, noarchive, nosnippet",
    );
    expect(landing.headers()["x-content-type-options"]).toBe("nosniff");

    const health = await page.request.get("/health");
    expect(health.status()).toBe(200);
    expect(health.headers()["cache-control"]).toBe("no-store");
    await expect(health.json()).resolves.toEqual({
      release: {
        commit: "abcdef012345",
        version: "0.1.0-e2e",
      },
      service: "zhenghao-project-desk",
      status: "ok",
    });
  });
});
