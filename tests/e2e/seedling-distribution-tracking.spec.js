// Seedling Inventory: automatic stock status, full-record inventory search, and Distribution Records batch tracking.
import { expect, test } from "@playwright/test";

const inventory = [
  { id: "inv-1", batchReference: "BAT-2026-003", species: "Kalamansi", scientificName: "Citrus microcarpa", category: "Fruit Tree",
    initialQuantity: 1200, currentQuantity: 1000, availableQuantity: 1000, totalReceivedQuantity: 1200, remainingStockPercent: 83.33,
    stockStatus: "Available", status: "Available", stockBaselineIssue: null, sourceType: "Donation", dateReceived: "2026-10-12", storageLocation: "MENRO Nursery" },
  { id: "inv-2", batchReference: "BAT-2026-007", species: "Kalamansi", scientificName: "Citrus microcarpa", category: "Fruit Tree",
    initialQuantity: 100, currentQuantity: 30, availableQuantity: 30, totalReceivedQuantity: 100, remainingStockPercent: 30,
    stockStatus: "Limited", status: "Limited", stockBaselineIssue: null, sourceType: "MENRO Propagation", dateReceived: "2026-09-01", storageLocation: "MENRO Nursery" },
  { id: "inv-3", batchReference: "BAT-2025-010", species: "Narra", scientificName: "Pterocarpus indicus", category: "Native Tree",
    initialQuantity: 50, currentQuantity: 40, availableQuantity: 40, totalReceivedQuantity: null, remainingStockPercent: null, replenishmentCycle: 2,
    stockStatus: "Needs Review", status: "Needs Review", stockBaselineIssue: "Total received quantity is missing or invalid.",
    sourceType: "DENR / PENRO", dateReceived: "2025-03-04", storageLocation: "MENRO Nursery" },
];

const allocation = (overrides) => ({ inventoryId: "inv-1", batchReference: "BAT-2026-003", inventoryNumber: "", sourceType: "Donation",
  sourceSpecification: "", dateReceived: "2026-10-12", basis: "release", liveRecordFound: true, recordFound: true, ...overrides });

const distributions = [
  { id: "dist-1", distributionNumber: "DIST-2026-001", requestNumber: "REQ-2026-001", participantName: "Juan Dela Cruz", barangay: "Bical",
    plantingLocation: "Bical Riverside", releasedAt: "2026-11-02T02:00:00.000Z", releasedBy: "uid-secret-123", releasedByName: "Maria Staff",
    status: "Released", totalQuantityReleased: 150, batchAllocations: [],
    items: [
      { inventoryId: "inv-1", species: "Kalamansi", quantity: 100, releasedQuantity: 100, allocation: allocation() },
      { inventoryId: "inv-2", species: "Kalamansi", quantity: 50, releasedQuantity: 50,
        allocation: allocation({ inventoryId: "inv-2", batchReference: "BAT-2026-007", sourceType: "MENRO Propagation", dateReceived: "2026-09-01", basis: "current-record" }) },
    ] },
  { id: "dist-2", distributionNumber: "DIST-2026-002", requestNumber: "REQ-2026-002", participantName: "Ana Reyes", barangay: "Zone 1",
    plantingLocation: "Zone 1 Park", releasedAt: "2026-11-05T03:00:00.000Z", releasedBy: "uid-other", releasedByName: "", status: "Released",
    totalQuantityReleased: 30, items: [{ inventoryId: "gone", species: "Narra", quantity: 30, releasedQuantity: 30,
      allocation: allocation({ inventoryId: "gone", batchReference: "", sourceType: "", dateReceived: "", basis: "unavailable", liveRecordFound: false, recordFound: false }) }] },
  { id: "dist-3", requestNumber: "REQ-2025-010", participantName: "Old Record", barangay: "Bical", inventoryId: "inv-legacy",
    species: "Mahogany", quantity: 20, releasedAt: "2025-05-01T00:00:00.000Z", status: "Released" },
];

async function setup(page) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== "http://127.0.0.1:5184") return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    let data = [];
    if (url.pathname === "/api/auth/profile") data = { uid: "test-staff", fullName: "Workflow User", province: "Sorsogon", municipality: "Bulan", barangay: "Bical" };
    else if (url.pathname === "/api/inventory") data = inventory;
    else if (url.pathname === "/api/inventory/species") data = [{ treeName: "Kalamansi", scientificName: "Citrus microcarpa" }];
    else if (url.pathname === "/api/distributions") data = distributions;
    else if (url.pathname === "/api/notifications/unread-count") data = { unreadCount: 0 };
    return route.fulfill({ json: { success: true, data } });
  });
  await page.goto("/staff/seedlings?role=staff");
  await expect(page.locator(".page-loading-state")).toHaveCount(0, { timeout: 20_000 });
}

const bodyRows = (page) => page.locator(".sd-record-card table tbody tr");

test("inventory search finds batch ref, source, date and quantity; status is automatic and Needs Review is filterable", async ({ page }) => {
  await setup(page);
  const search = page.getByPlaceholder("Search seedlings...");
  for (const [query, expected] of [["BAT-2026-003", ["BAT-2026-003"]], ["donation", ["BAT-2026-003"]], ["2026-10-12", ["BAT-2026-003"]],
    ["Oct 12, 2026", ["BAT-2026-003"]], ["1,000", ["BAT-2026-003"]], ["kalamansi", ["BAT-2026-003", "BAT-2026-007"]], ["  KALAMANSI   propagation ", ["BAT-2026-007"]]]) {
    await search.fill(query);
    await expect(bodyRows(page).locator("td:nth-child(2)")).toHaveText(expected);
  }
  await search.fill("");
  await expect(bodyRows(page).filter({ hasText: "BAT-2026-007" }).locator(".sd-status")).toHaveText("Limited");
  await page.locator(".sd-filter-select select").nth(1).selectOption("Needs Review");
  await expect(bodyRows(page).locator("td:nth-child(2)")).toHaveText(["BAT-2025-010"]);
  await expect(bodyRows(page).locator(".sd-status-needs-review")).toHaveText("Needs Review");

  await page.getByRole("button", { name: "Add Seedling", exact: true }).click();
  await expect(page.locator(".sd-modal").getByText("Stock Status *")).toHaveCount(0);
  const automatic = page.getByRole("textbox", { name: "Stock Status (automatic)" });
  await expect(automatic).toHaveAttribute("readonly", "");
  await page.getByPlaceholder("Enter initial quantity").fill("0");
  await expect(automatic).toHaveValue("Out of Stock");
});

test("distribution filters sit inside the container below the sub-tabs and above the table; batch view tracks allocations", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Distribution Records", exact: true }).click();
  const card = page.locator(".sd-record-card");
  const bar = card.locator(".sd-distribution-filter-bar");
  await expect(bar).toBeVisible();
  const [tabs, subtabs, filters, head] = await Promise.all([card.locator(".sd-tabs"), card.locator(".sd-subtabs"), bar, card.locator("table thead")].map((l) => l.boundingBox()));
  expect(subtabs.y).toBeGreaterThanOrEqual(tabs.y + tabs.height - 1);
  expect(filters.y).toBeGreaterThanOrEqual(subtabs.y + subtabs.height - 1);
  expect(head.y).toBeGreaterThanOrEqual(filters.y + filters.height - 1);
  // Same filter design as the Seedlings tab.
  await expect(bar.locator(".sd-search input")).toHaveCSS("height", "44px");
  await expect(bar.locator(".sd-filter-select").first()).toHaveCSS("border-top-color", "rgb(223, 230, 225)");

  // All Transactions: the existing table, released by name only.
  await expect(bodyRows(page)).toHaveCount(3);
  await expect(card).not.toContainText("uid-secret-123");
  // Newest release first, as before.
  await expect(bodyRows(page).filter({ hasText: "DIST-2026-001" })).toContainText("Maria Staff");
  await bar.getByLabel("Source type").selectOption("Donation");
  await expect(bodyRows(page)).toHaveCount(1);
  await expect(card.locator(".sd-results-text")).toHaveText("Showing 1 of 3 transactions · 100 seedlings released in matching batch allocations");

  await page.getByRole("tab", { name: "By Inventory Batch" }).click();
  await expect(bodyRows(page)).toHaveCount(1);
  await bar.getByRole("button", { name: "Reset distribution filters" }).click();
  await expect(bodyRows(page)).toHaveCount(4);
  await expect(bodyRows(page).locator("td:first-child")).toHaveText(["DIST-2026-002", "DIST-2026-001", "DIST-2026-001", "dist-3"]);
  await expect(bodyRows(page).nth(2)).toContainText("(current record)");
  await expect(bodyRows(page).nth(1)).not.toContainText("(current record)");
  await expect(bodyRows(page).nth(0)).toContainText("Batch record unavailable");
  await expect(bodyRows(page).nth(0)).toContainText("Not recorded");
  await expect(bodyRows(page).nth(3)).toContainText("Mahogany");
  await expect(card.locator(".sd-results-text")).toHaveText("Showing 4 batch allocations from 3 of 3 transactions · 200 seedlings released");

  await bar.getByLabel("Source type").selectOption("MENRO Propagation");
  await bar.getByLabel("Seedling type").selectOption("Kalamansi");
  await expect(bodyRows(page).locator("td:nth-child(2)")).toHaveText(["BAT-2026-007"]);
  await expect(card.locator(".sd-results-text")).toHaveText("Showing 1 batch allocation from 1 of 3 transactions · 50 seedlings released");
  await bar.getByLabel("Date released").fill("2026-11-05");
  await expect(card.getByText("No matching distribution records")).toBeVisible();
  await card.locator(".sd-distribution-empty").getByRole("button", { name: "Reset Filters" }).click();
  await bar.getByLabel("Search distribution records").fill("bat-2026-003");
  await expect(bodyRows(page).locator("td:nth-child(2)")).toHaveText(["BAT-2026-003"]);
});

test("distribution tracking stays within the page at phone width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.getByRole("button", { name: "Distribution Records", exact: true }).click();
  await page.getByRole("tab", { name: "By Inventory Batch" }).click();
  await expect(page.locator(".sd-distribution-filter-bar")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("a distribution deep link opens All Transactions unfiltered and highlights the record", async ({ page }) => {
  await setup(page);
  await page.goto("/staff/seedlings?role=staff&tab=distribution&distribution=dist-2");
  await expect(page.locator("#distribution-dist-2.sd-distribution-highlight")).toBeVisible();
  await expect(page.getByRole("tab", { name: "All Transactions" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Search distribution records")).toHaveValue("");
});

test("Update Seedling shows the automatic status read-only and never sends a stock status", async ({ page }) => {
  await setup(page);
  let patchBody = null;
  await page.route("**/api/inventory/inv-2", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    patchBody = route.request().postDataJSON();
    return route.fulfill({ json: { success: true, data: { ...inventory[1], description: patchBody.description } } });
  });
  await bodyRows(page).filter({ hasText: "BAT-2026-007" }).getByTitle("Edit seedling").click();
  const modal = page.locator(".sd-modal");
  await expect(modal.getByRole("heading", { name: "Update Seedling" })).toBeVisible();
  await expect(modal.getByRole("combobox")).toHaveCount(0);
  await expect(modal.getByText("Stock Status *")).toHaveCount(0);
  await expect(modal).toContainText("Stock Status (automatic)");
  await expect(modal).toContainText("Limited");
  await modal.locator("textarea").fill("Hardened seedlings");
  await modal.getByRole("button", { name: "Save Changes" }).click();
  await expect.poll(() => patchBody).not.toBeNull();
  expect(patchBody).toEqual({ description: "Hardened seedlings" });
});
