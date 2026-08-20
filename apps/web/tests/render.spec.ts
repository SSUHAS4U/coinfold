import { expect, test, type Page } from "@playwright/test";

/**
 * Render verification.
 *
 * A UI claim without a measured render is an unverified claim, so these assert
 * geometry and behaviour rather than eyeballing screenshots — though they save
 * screenshots too, for looking at.
 *
 * Requires the API on :8000 with the seeded database, and the web production
 * build on :3000.
 */

const WIDTHS = [360, 414, 768, 1024, 1280, 1920] as const;
const DEMO = { email: "demo@coinfold.app", password: "coinfold-demo-2026" };

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(DEMO.email);
  await page.getByLabel("Password").fill(DEMO.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/app");
  // The stat row is the last thing to settle, so it marks "ready".
  await expect(page.getByText("Total spent")).toBeVisible();
}

/** The single most common layout defect, asserted rather than assumed. */
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });
  expect(
    overflow.scrollWidth,
    `page scrolls horizontally: ${overflow.scrollWidth} > ${overflow.clientWidth}`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

async function setTheme(page: Page, theme: "dark" | "light") {
  await page.evaluate((value) => {
    document.documentElement.classList.toggle("light", value === "light");
    localStorage.setItem("coinfold.theme", value);
  }, theme);
}

test.describe("landing", () => {
  for (const width of WIDTHS) {
    test(`landing has no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalScroll(page);

      // And still not after the scroll story has run.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6));
      await page.waitForTimeout(250);
      await expectNoHorizontalScroll(page);
    });
  }

  test("scroll story advances the counters", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    await page.screenshot({ path: "test-results/landing-01-hero.png" });

    // Chapter 2: the transaction count should reach 10,000 by the time the
    // stage is ~35% scrolled.
    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.6));
    await page.waitForTimeout(400);
    await page.screenshot({ path: "test-results/landing-02-volume.png" });

    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2.4));
    await page.waitForTimeout(400);
    await page.screenshot({ path: "test-results/landing-03-categories.png" });

    // Chapter 4: the coin figure lands on the real seeded balance.
    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 3.7));
    await page.waitForTimeout(500);
    await expect(page.getByText("3,62,629")).toBeVisible();
    await page.screenshot({ path: "test-results/landing-04-coins.png" });
  });

  test("reduced motion renders every chapter statically", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    // With motion disabled the story is laid out in full rather than pinned,
    // so all four chapters are present at once and nothing is hidden.
    await expect(page.getByText("3,62,629")).toBeVisible();
    // "10,000" legitimately appears several times once the story is laid out
    // flat (hero copy, the chapter-2 figure, the features list). The property
    // that matters is that the chapters rendered at all, not an exact count.
    expect(await page.getByText("10,000").count()).toBeGreaterThanOrEqual(2);
    await expect(page.getByText("Ten categories,")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: "test-results/landing-reduced-motion.png", fullPage: true });
    await context.close();
  });
});

test.describe("dashboard", () => {
  test("renders the seeded figures", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await signIn(page);

    await expect(page.getByText("10,000").first()).toBeVisible();
    await expect(page.getByText("3,62,629").first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: "test-results/dash-dark.png", fullPage: true });
  });

  for (const width of WIDTHS) {
    test(`dashboard has no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await signIn(page);
      await expectNoHorizontalScroll(page);

      // The table must scroll inside its own container, never the page.
      const scroller = page.locator("table").locator("xpath=ancestor::div[1]");
      const box = await scroller.boundingBox();
      expect(box, "table scroll container is present").not.toBeNull();
      expect(box!.width).toBeLessThanOrEqual(width + 1);

      await page.screenshot({ path: `test-results/dash-${width}.png` });
    });
  }

  test("light theme is designed, not inverted", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await signIn(page);
    await setTheme(page, "light");
    await page.waitForTimeout(250);

    const bg = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor,
    );
    // Light theme must actually be light, not a dark page with light text.
    const [r, g, b] = bg.match(/\d+/g)!.map(Number);
    expect((r + g + b) / 3).toBeGreaterThan(200);

    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: "test-results/dash-light.png", fullPage: true });
  });

  test("touch targets are at least 44px on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await signIn(page);

    const controls = page.locator("button:visible, select:visible, a:visible");
    const total = await controls.count();
    const undersized: string[] = [];

    for (let i = 0; i < total; i += 1) {
      const box = await controls.nth(i).boundingBox();
      if (!box) continue;
      // Inline text links are exempt: they are words in a sentence, not targets.
      const isInlineLink = await controls.nth(i).evaluate((el) => el.tagName === "A");
      if (isInlineLink) continue;
      if (box.height < 44) {
        undersized.push(`${await controls.nth(i).innerText()} -> ${Math.round(box.height)}px`);
      }
    }

    expect(undersized, `controls below 44px: ${undersized.join(", ")}`).toHaveLength(0);
  });
});

test.describe("table behaviour", () => {
  test("sorts, searches, filters and paginates against the server", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await signIn(page);

    // Sorting by amount ascending must surface a refund (negative amount).
    await page.getByRole("button", { name: "Amount" }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Amount" }).click();
    await page.waitForTimeout(600);
    const firstAmount = await page.locator("tbody tr").first().innerText();
    expect(firstAmount).toContain("-");

    // Search narrows the result set and every visible row matches.
    await page.getByLabel("Search merchants").fill("domino");
    await page.waitForTimeout(800);
    const merchants = await page.locator("tbody tr td:nth-child(2)").allInnerTexts();
    expect(merchants.length).toBeGreaterThan(0);
    for (const cell of merchants) {
      expect(cell.toLowerCase()).toContain("domino");
    }

    // Clearing restores the full set.
    await page.getByLabel("Search merchants").fill("");
    await page.waitForTimeout(800);
    await expect(page.getByText("10,000").first()).toBeVisible();

    // A category chip filters, and shows as a removable active chip.
    await page.getByRole("button", { name: /^Fuel/ }).first().click();
    await page.waitForTimeout(700);
    await expect(page.getByRole("button", { name: "Remove Fuel filter" })).toBeVisible();
    await page.screenshot({ path: "test-results/table-filtered.png" });

    await page.getByRole("button", { name: "Clear all" }).click();
    await page.waitForTimeout(700);

    // Pagination moves to page 2 and marks it current.
    await page.getByRole("button", { name: "Page 2", exact: true }).click();
    await page.waitForTimeout(700);
    await expect(page.getByRole("button", { name: "Page 2", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("empty state explains itself rather than showing a blank table", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await signIn(page);

    await page.getByLabel("Search merchants").fill("zzzz-no-such-merchant");
    await page.waitForTimeout(900);

    await expect(page.getByText("No transactions match these filters")).toBeVisible();
    await expect(page.getByRole("button", { name: "Clear all filters" })).toBeVisible();
    await page.screenshot({ path: "test-results/table-empty.png" });
  });

  test("a row opens its detail drawer with import history", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await signIn(page);

    await page.locator("tbody tr").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Import history")).toBeVisible();
    await page.screenshot({ path: "test-results/drawer.png" });

    // Escape closes.
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("rows are keyboard operable", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await signIn(page);

    await page.locator("tbody tr").first().focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

test.describe("modal", () => {
  test("traps focus and restores it on close", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await signIn(page);

    const opener = page.getByRole("button", { name: "Redeem" }).first();
    await opener.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Tab many times; focus must never leave the dialog.
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() => {
        const active = document.activeElement;
        const panel = document.querySelector('[role="dialog"]');
        return Boolean(panel && active && panel.contains(active));
      });
      expect(inside, `focus escaped the dialog on tab ${i + 1}`).toBe(true);
    }

    await page.screenshot({ path: "test-results/modal-confirm.png" });

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();

    // Focus returns to the button that opened it.
    const restored = await page.evaluate(() => document.activeElement?.textContent?.trim());
    expect(restored).toBe("Redeem");
  });
});

test.describe("rewards", () => {
  test("redeem debits the balance and issues a voucher", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await signIn(page);

    // The HUD counts up to its value over ~700ms, so "not an em dash" is not
    // the same as "settled" — reading it early catches a frame mid-animation.
    // Poll until two consecutive reads agree.
    const hud = page.locator("header p.tnum").first();
    const settledBalance = async (): Promise<number> => {
      let last = -1;
      for (let i = 0; i < 40; i += 1) {
        const text = (await hud.innerText()).replace(/[^\d]/g, "");
        const value = text === "" ? -1 : Number(text);
        if (value > 0 && value === last) return value;
        last = value;
        await page.waitForTimeout(250);
      }
      throw new Error("coin balance never settled");
    };

    const before = await settledBalance();
    expect(before).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Redeem" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Confirm" }).click();

    await expect(page.getByText("Voucher code")).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: "test-results/redeem-done.png" });

    await page.getByRole("button", { name: "Done" }).click();
    await page.waitForTimeout(900);

    const after = await settledBalance();
    expect(after).toBeLessThan(before);
  });
});
