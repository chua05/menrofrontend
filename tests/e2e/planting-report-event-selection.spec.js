import { test, expect } from "@playwright/test";
import process from "node:process";

const FRONTEND = process.env.MENRO_ACCEPTANCE_FRONTEND || "http://127.0.0.1:5173";
const API = process.env.MENRO_ACCEPTANCE_API_URL || "http://127.0.0.1:5000/api";
const EMAIL = "request-letter.browser.participant@example.test";
const PASSWORD = "Request-Letter-Browser!2026";
const SITE_ID = "planting-browser-espie";
const INDIVIDUAL_EVENT = "planting-browser-individual-oct27";
const ORGANIZATION_EVENT = "planting-browser-organization-oct27";
const EMPTY_EVENT = "planting-browser-empty-distribution";

if (!/^http:\/\/(?:127\.0\.0\.1|localhost):517[34]$/.test(FRONTEND) ||
    !/^http:\/\/(?:127\.0\.0\.1|localhost):500[01]\/api$/.test(API)) {
  throw new Error("Planting-report browser acceptance requires approved loopback endpoints.");
}

const viewports = [
  ["desktop", { width: 1440, height: 900 }],
  ["android", { width: 390, height: 844 }],
  ["iphone", { width: 375, height: 812 }],
];

async function loginAndOpen(page) {
  await page.goto(`${FRONTEND}/login`);
  await page.getByLabel("Email Address").fill(EMAIL);
  await page.locator("#login-password").fill(PASSWORD);
  await page.locator(".login-primary-btn").click();
  await expect(page).toHaveURL(/\/participant\//);
  await page.goto(`${FRONTEND}/participant/my-planting-reports`);
  await expect(page.getByRole("heading", { name: "My Planting Reports" })).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "Submit Planting Report" }).click();
  await expect(page.getByRole("heading", { name: "Submit Planting Report" })).toBeVisible();
}

function selectNearLabel(page, label) {
  return page.locator("label.pr-label", { hasText: label }).locator("xpath=following-sibling::select[1]");
}

async function chooseEvent(page, eventId) {
  await selectNearLabel(page, "Barangay").selectOption({ label: "N.Roque" });
  await selectNearLabel(page, "Planting Site").selectOption(SITE_ID);
  await selectNearLabel(page, "Planting Event").selectOption(eventId);
}

for (const [name, viewport] of viewports) {
  test(`${name}: individual and organization event selection remains usable`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await loginAndOpen(page);

    await chooseEvent(page, INDIVIDUAL_EVENT);
    await expect(selectNearLabel(page, "Planting Event")).toHaveValue(INDIVIDUAL_EVENT);
    await expect(page.locator('input[type="date"]').first()).toHaveValue("2026-10-27");
    await selectNearLabel(page, "Released Seedling Distribution").selectOption("planting-browser-individual-distribution");
    await expect(page.locator(".pr-site-preview-name", { hasText: "Synthetic Participant" })).toBeVisible();

    await chooseEvent(page, ORGANIZATION_EVENT);
    await expect(selectNearLabel(page, "Planting Event")).toHaveValue(ORGANIZATION_EVENT);
    await expect(selectNearLabel(page, "Released Seedling Distribution")).toHaveValue("");
    await expect(errors).toEqual([]);
  });
}

test("malformed participant metadata is rendered safely and missing distributions are explained", async ({ page }) => {
  let malformed = true;
  await page.route("**/api/events", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    if (malformed && Array.isArray(payload?.data)) {
      payload.data = payload.data.map((event) => event.id === INDIVIDUAL_EVENT
        ? { ...event, actualParticipants: { _seconds: 1, _nanoseconds: 2 } }
        : event);
      await route.fulfill({ response, json: payload });
      return;
    }
    await route.fulfill({ response });
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await loginAndOpen(page);
  await chooseEvent(page, INDIVIDUAL_EVENT);
  await selectNearLabel(page, "Released Seedling Distribution").selectOption("planting-browser-individual-distribution");
  await expect(page.getByText(/Registered event participants: Not Yet Identified/)).toBeVisible();
  await expect(errors).toEqual([]);

  malformed = false;
  await chooseEvent(page, EMPTY_EVENT);
  await expect(page.getByText("No released seedling distributions are available for this planting event.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Submit Planting Report" })).toBeVisible();
});

test("malformed event rendering falls back without a blank page and recovers", async ({ page }) => {
  let malformed = true;
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/events", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    if (malformed && Array.isArray(payload?.data)) {
      payload.data = payload.data.map((event) => event.id === INDIVIDUAL_EVENT
        ? { ...event, eventName: { _seconds: 1, _nanoseconds: 2 } }
        : event);
      await route.fulfill({ response, json: payload });
      return;
    }
    await route.fulfill({ response });
  });

  await loginAndOpen(page);
  await page.locator('input[placeholder="Enter full name"]').fill("Draft participant name");
  await selectNearLabel(page, "Barangay").selectOption({ label: "N.Roque" });
  await selectNearLabel(page, "Planting Site").selectOption(SITE_ID);
  await expect(page.getByRole("heading", { name: "Unable to display this planting report form" })).toBeVisible();
  malformed = false;
  await page.getByRole("button", { name: "Retry Form" }).click();
  await expect(page.getByRole("heading", { name: "Submit Planting Report" })).toBeVisible();
  await expect(page.locator('input[placeholder="Enter full name"]')).toHaveValue("Draft participant name");
  await expect(errors).toEqual([]);
});
