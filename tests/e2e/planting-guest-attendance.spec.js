import process from "node:process";
import { expect, test } from "@playwright/test";

// Requires backend fixtures: `node tests/integration/seedPlantingViewReportBrowserAcceptance.js`
// (menrosystem backend), which seeds "View Report Attendance Site" with a guest
// invitation link (token in GUEST_TOKEN) and one abandoned legacy reservation.
const FRONTEND = "http://127.0.0.1:5173";
const PASSWORD = "Planting-View-Browser!2026";
const SITE = "View Report Attendance Site";
const TOKEN = process.env.GUEST_TOKEN || "";

test.describe.configure({ mode: "serial" });

function watchErrors(page) {
  const problems = [];
  page.on("pageerror", (error) => problems.push(error.message));
  return problems;
}

async function login(page, role, path) {
  await page.goto(`${FRONTEND}/login`);
  await page.getByLabel("Email Address").fill(`planting-view.${role}@example.test`);
  await page.locator("#login-password").fill(PASSWORD);
  await page.locator(".login-primary-btn").click();
  await expect(page).toHaveURL(new RegExp(`/${role}/`));
  if (role === "participant") await expect(page.getByText(/^Welcome, /)).toBeVisible({ timeout: 20_000 });
  await page.goto(`${FRONTEND}${path}`);
}

async function openAttendance(page) {
  const row = page.locator("tr", { hasText: SITE });
  await expect(row).toHaveCount(1, { timeout: 20_000 });
  await row.getByRole("button", { name: /^View / }).click();
  const drawer = page.getByRole("dialog", { name: /Planting report/ });
  await expect(drawer).toBeVisible();
  const panel = drawer.locator(".pr-event-attendance");
  await expect(panel).toBeVisible({ timeout: 20_000 });
  return { drawer, panel };
}

test("a guest registers attendance with Full Name, Contact Number and Address only", async ({ page }) => {
  test.skip(!TOKEN, "GUEST_TOKEN is provided by the seed script");
  const problems = watchErrors(page);
  await page.goto(`${FRONTEND}/join-event/${encodeURIComponent(TOKEN)}`);
  await expect(page.getByRole("heading", { name: "Tree Planting Event Attendance" })).toBeVisible({ timeout: 20_000 });
  const form = page.locator("form.guest-event-form");
  await expect(form.locator("input, textarea, select")).toHaveCount(3);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.getByText(/Quantity|Photo/)).toHaveCount(0);

  await form.getByRole("button", { name: "Register Attendance" }).click();
  await expect(form.locator("#guest-fullName-error")).toBeVisible();
  await expect(form.locator("#guest-contactNumber-error")).toBeVisible();
  await expect(form.locator("#guest-address-error")).toBeVisible();

  await form.locator("#guest-fullName").fill("Maria Santos");
  await form.locator("#guest-contactNumber").fill("09171234567");
  await form.locator("#guest-address").fill("Purok 3, Barangay Bical, Bulan");
  await form.getByRole("button", { name: "Register Attendance" }).click();
  await expect(page.getByRole("heading", { name: "Attendance recorded" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Thank you, Maria Santos.")).toBeVisible();

  // One attendance per event and contact number.
  await page.getByRole("button", { name: "Register another attendee" }).click();
  await form.locator("#guest-fullName").fill("Maria S. Santos");
  await form.locator("#guest-contactNumber").fill("+639171234567");
  await form.locator("#guest-address").fill("Purok 3, Bical");
  await form.getByRole("button", { name: "Register Attendance" }).click();
  await expect(page.getByText("This contact number is already registered for this event.").first()).toBeVisible();
  expect(problems).toEqual([]);
});

test("a tampered guest link is refused", async ({ page }) => {
  test.skip(!TOKEN, "GUEST_TOKEN is provided by the seed script");
  const [eventId] = TOKEN.split(".");
  await page.goto(`${FRONTEND}/join-event/${encodeURIComponent(`${eventId}.${"0".repeat(64)}.${"0".repeat(64)}`)}`);
  await expect(page.getByRole("alert")).toContainText("Guest event not found.", { timeout: 20_000 });
  await expect(page.locator("form.guest-event-form")).toHaveCount(0);
});

test("the event requester sees the attendance list in their report", async ({ page }) => {
  test.skip(!TOKEN, "GUEST_TOKEN is provided by the seed script");
  const problems = watchErrors(page);
  await login(page, "participant", "/participant/my-planting-reports");
  const { panel } = await openAttendance(page);
  const row = panel.locator(".pr-attendance-table tbody tr");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Maria Santos");
  await expect(row).toContainText("09171234567");
  await expect(row).toContainText("Purok 3, Barangay Bical, Bulan");
  await expect(panel.locator(".pr-legacy-reservations")).toHaveCount(0, { timeout: 1 });
  expect(problems).toEqual([]);
});

test("Staff see attendance and release an abandoned legacy reservation with a required reason", async ({ page }) => {
  test.skip(!TOKEN, "GUEST_TOKEN is provided by the seed script");
  const problems = watchErrors(page);
  await login(page, "staff", "/staff/planting-reports");
  const { panel } = await openAttendance(page);
  await expect(panel.locator(".pr-attendance-table tbody tr")).toContainText("Maria Santos");
  const reservation = panel.locator(".pr-legacy-reservation-list li");
  await expect(reservation).toHaveCount(1);
  await expect(reservation).toContainText("3 × Narra — Former Guest · Reserved");
  await reservation.getByRole("button", { name: "Release Reservation" }).click();
  await reservation.getByRole("button", { name: "Confirm Release" }).click();
  await expect(reservation.getByRole("alert")).toHaveText("Enter the reason for releasing this reservation.");
  await reservation.locator("textarea").fill("Guest never uploaded evidence after the event");
  await reservation.getByRole("button", { name: "Confirm Release" }).click();
  await expect(reservation).toContainText("· Released", { timeout: 20_000 });
  await expect(reservation).toContainText("Guest never uploaded evidence after the event");
  await expect(reservation.getByRole("button", { name: "Release Reservation" })).toHaveCount(0);
  expect(problems).toEqual([]);
});
