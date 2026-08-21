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
  await expect(page.getByText("Total spent")).toBeVisible();
}

/** Go straight to a section, signing in first. */
async function open(page: Page, path: string) {
  await signIn(page);
  if (path !== "/app") {
    await page.goto(path);
  }
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

/**
 * The coin HUD counts up to its value over ~700ms, so "not an em dash" is not
 * the same as "settled". Poll until two consecutive reads agree.
 */
async function settledBalance(page: Page): Promise<number> {
  const hud = page.locator("header p.tnum").first();
  let last = -1;
  for (let i = 0; i < 40; i += 1) {
    const text = (await hud.innerText()).replace(/[^\d]/g, "");
    const value = text === "" ? -1 : Number(text);
    if (value > 0 && value === last) return value;
    last = value;
    await page.waitForTimeout(250);
  }
  throw new Error("coin balance never settled");
}

// ---------------------------------------------------------------------------
// Landing
// ---------------------------------------------------------------------------

test.describe("landing", () => {
  for (const width of WIDTHS) {
    test(`landing has no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalScroll(page);

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6));
      await page.waitForTimeout(250);
      await expectNoHorizontalScroll(page);
    });
  }

  test("the photographs carry the scroll story", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    // Every chapter image is mounted, so the story cannot pop in unloaded.
    const images = page.locator("img");
    expect(await images.count()).toBeGreaterThanOrEqual(4);

    await page.screenshot({ path: "test-results/landing-01-hero.png" });

    // The images must actually MOVE with scroll — that is the whole point of
    // the rebuild. Compare a chapter's transform before and after scrolling.
    const transformAt = async (offset: number) => {
      await page.evaluate((y) => window.scrollTo(0, y), offset);
      await page.waitForTimeout(350);
      return page.evaluate(() => {
        const layer = document.querySelector<HTMLElement>("img")?.parentElement;
        return layer ? getComputedStyle(layer).transform : "none";
      });
    };

    const early = await transformAt(0);
    const later = await transformAt(1400);
    expect(early, "the hero image should transform as the page scrolls").not.toBe(later);

    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2));
    await page.waitForTimeout(350);
    await page.screenshot({ path: "test-results/landing-02-volume.png" });

    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 3.6));
    await page.waitForTimeout(350);
    await page.screenshot({ path: "test-results/landing-03-sort.png" });

    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 4.8));
    await page.waitForTimeout(450);
    await expect(page.getByText("3,62,629")).toBeVisible();
    await page.screenshot({ path: "test-results/landing-04-coins.png" });
  });

  test("reduced motion lays every chapter out statically", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    await expect(page.getByText("3,62,629")).toBeVisible();
    await expect(page.getByText("Ten categories. One glance.")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: "test-results/landing-reduced-motion.png", fullPage: true });
    await context.close();
  });
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

test.describe("auth", () => {
  test("sign-up validates live and blocks a weak password", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.goto("/signup");

    const submit = page.getByRole("button", { name: "Create account" });
    await expect(submit).toBeDisabled();

    await page.getByLabel("Your name").fill("Test Person");
    await page.getByLabel("Email").fill(`t-${Date.now()}@coinfold.app`);
    await page.getByLabel("Password").fill("short");
    await expect(submit, "a 5-character password must not be submittable").toBeDisabled();

    await page.getByLabel("Password").fill("a-long-enough-password-1");
    await expect(submit).toBeEnabled();

    await page.screenshot({ path: "test-results/signup.png" });
  });

  test("sign-up creates an account with its own seeded data", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.goto("/signup");

    await page.getByLabel("Your name").fill("Fresh Account");
    await page.getByLabel("Email").fill(`fresh-${Date.now()}@coinfold.app`);
    await page.getByLabel("Password").fill("a-long-enough-password-1");
    await page.getByRole("button", { name: "Create account" }).click();

    await page.waitForURL("**/app", { timeout: 30_000 });
    // A new account starts with the full seeded ledger, untouched.
    expect(await settledBalance(page)).toBe(362629);
  });

  for (const path of ["/login", "/signup"]) {
    test(`${path} has no horizontal scroll at 360px`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 780 });
      await page.goto(path);
      await expectNoHorizontalScroll(page);
    });
  }
});

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------

test.describe("app shell", () => {
  test("the sidebar navigates between sections", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await signIn(page);

    const nav = page.getByRole("navigation", { name: "Sections" });
    await expect(nav).toBeVisible();

    // Overview is current on arrival, and only Overview.
    await expect(nav.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    for (const [label, path, marker] of [
      ["Transactions", "/app/transactions", "Search merchants"],
      ["Analytics", "/app/analytics", "Month by month"],
      ["Rewards", "/app/rewards", "Redemption history"],
    ] as const) {
      await nav.getByRole("link", { name: label }).click();
      await page.waitForURL(`**${path}`);
      await expect(nav.getByRole("link", { name: label })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(page.getByText(marker).first()).toBeVisible();
      await expectNoHorizontalScroll(page);
      await page.screenshot({ path: `test-results/section-${label.toLowerCase()}.png` });
    }
  });

  test("filters survive navigation between sections", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await open(page, "/app/transactions");

    await page.getByRole("button", { name: /^Fuel/ }).first().click();
    await page.waitForTimeout(800);

    const nav = page.getByRole("navigation", { name: "Sections" });
    await nav.getByRole("link", { name: "Analytics" }).click();
    await page.waitForURL("**/app/analytics");
    await page.waitForTimeout(500);

    // The filter chip is still applied — state lives in the layout, not the page.
    await expect(page.getByRole("button", { name: "Remove Fuel filter" })).toBeVisible();
  });

  test("the sidebar becomes a drawer on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await signIn(page);

    // The permanent sidebar must be gone, and the trigger present.
    await expect(page.getByRole("navigation", { name: "Sections" })).toBeHidden();
    const trigger = page.getByRole("button", { name: "Open navigation" });
    await expect(trigger).toBeVisible();

    await trigger.click();
    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await expect(drawer).toBeVisible();
    await page.screenshot({ path: "test-results/mobile-drawer.png" });

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });

  for (const width of WIDTHS) {
    test(`app has no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, "/app/transactions");
      await expectNoHorizontalScroll(page);

      const scroller = page.locator("table").locator("xpath=ancestor::div[1]");
      const box = await scroller.boundingBox();
      expect(box, "table scroll container is present").not.toBeNull();
      expect(box!.width).toBeLessThanOrEqual(width + 1);

      await page.screenshot({ path: `test-results/app-${width}.png` });
    });
  }

  test("light theme is designed, not inverted", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await signIn(page);
    await setTheme(page, "light");
    await page.waitForTimeout(250);

    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const [r, g, b] = bg.match(/\d+/g)!.map(Number);
    expect((r + g + b) / 3).toBeGreaterThan(200);

    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: "test-results/app-light.png", fullPage: true });
  });

  test("touch targets are at least 44px on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await open(page, "/app/transactions");

    const controls = page.locator("button:visible, select:visible");
    const total = await controls.count();
    const undersized: string[] = [];

    for (let i = 0; i < total; i += 1) {
      const box = await controls.nth(i).boundingBox();
      if (!box) continue;
      if (box.height < 44) {
        undersized.push(`${await controls.nth(i).innerText()} -> ${Math.round(box.height)}px`);
      }
    }

    expect(undersized, `controls below 44px: ${undersized.join(", ")}`).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

test.describe("transactions", () => {
  test("sorts, searches, filters and paginates against the server", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await open(page, "/app/transactions");

    // Sorting by amount ascending must surface a refund (negative amount).
    await page.getByRole("button", { name: "Amount" }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Amount" }).click();
    await page.waitForTimeout(700);
    expect(await page.locator("tbody tr").first().innerText()).toContain("-");

    await page.getByLabel("Search merchants").fill("domino");
    await page.waitForTimeout(900);
    const merchants = await page.locator("tbody tr td:nth-child(2)").allInnerTexts();
    expect(merchants.length).toBeGreaterThan(0);
    for (const cell of merchants) {
      expect(cell.toLowerCase()).toContain("domino");
    }

    await page.getByLabel("Search merchants").fill("");
    await page.waitForTimeout(900);
    await expect(page.getByText("10,000").first()).toBeVisible();

    await page.getByRole("button", { name: /^Fuel/ }).first().click();
    await page.waitForTimeout(800);
    await expect(page.getByRole("button", { name: "Remove Fuel filter" })).toBeVisible();

    await page.getByRole("button", { name: "Clear all" }).click();
    await page.waitForTimeout(800);

    await page.getByRole("button", { name: "Page 2", exact: true }).click();
    await page.waitForTimeout(800);
    await expect(page.getByRole("button", { name: "Page 2", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("empty state explains itself rather than showing a blank table", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await open(page, "/app/transactions");

    await page.getByLabel("Search merchants").fill("zzzz-no-such-merchant");
    await page.waitForTimeout(1000);

    await expect(page.getByText("No transactions match these filters")).toBeVisible();
    await expect(page.getByRole("button", { name: "Clear all filters" })).toBeVisible();
    await page.screenshot({ path: "test-results/table-empty.png" });
  });

  test("a row opens its detail drawer with import history", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await open(page, "/app/transactions");

    await page.locator("tbody tr").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Import history")).toBeVisible();
    await page.screenshot({ path: "test-results/drawer.png" });

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("rows are keyboard operable", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await open(page, "/app/transactions");

    await page.locator("tbody tr").first().focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------

test.describe("rewards", () => {
  test("the modal traps focus and restores it on close", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await open(page, "/app/rewards");

    const opener = page.getByRole("button", { name: "Redeem" }).first();
    await opener.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

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
    await expect(dialog).toBeHidden();

    const restored = await page.evaluate(() => document.activeElement?.textContent?.trim());
    expect(restored).toBe("Redeem");
  });

  test("redeem debits the balance and records it in history", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await open(page, "/app/rewards");

    const before = await settledBalance(page);

    await page.getByRole("button", { name: "Redeem" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Confirm" }).click();

    await expect(page.getByText("Voucher code")).toBeVisible({ timeout: 25_000 });
    await page.screenshot({ path: "test-results/redeem-done.png" });

    await page.getByRole("button", { name: "Done" }).click();
    await page.waitForTimeout(1200);

    expect(await settledBalance(page)).toBeLessThan(before);

    // The redemption must appear in history — previously the API served this
    // and nothing displayed it, so a voucher code could not be found again.
    await expect(page.locator("code").first()).toBeVisible();
  });
});
