import { expect, test } from "@playwright/test";

const ORIGIN = "http://127.0.0.1:5184";
const uid = "test-participant";
const barangay = "San Francisco (Poblacion)";
const statuses = ["Pending", "Approved", "Released", "Completed", "Rejected"];
const sites = Array.from({ length: 8 }, (_, index) => ({
  id: `s${index}`, name: `Barangay Sagrada Upland Reforestation Site ${index}`, siteName: `Barangay Sagrada Upland Reforestation Site ${index}`,
  barangay, areaHectares: 12.5 + index, status: "Active", latitude: 12.67, longitude: 123.87, capacity: 5000,
}));
const requests = Array.from({ length: 14 }, (_, index) => ({
  id: `r${index}`, userId: uid, requestNumber: `REQ-2026-${100 + index}`, participantName: "Bulan National High School Environmental Club",
  status: statuses[index % 5], items: [{ inventoryId: "narra", species: "Narra", quantity: 120 + index }], totalQuantity: 120 + index,
  barangay, proposedDate: "2099-12-01", plantingSiteName: sites[0].name, createdAt: `2026-10-${10 + index}T02:00:00Z`,
}));
const reports = Array.from({ length: 10 }, (_, index) => ({
  id: `p${index}`, userId: uid, status: index % 2 ? "Verified" : "Pending", siteId: `s${index % 8}`, siteName: sites[index % 8].name,
  barangay, species: "Narra", quantityPlanted: 1250 + index, seedlingsPlanted: 1250 + index,
  plantingDate: `2026-10-1${index % 9}`, createdAt: `2026-10-1${index % 9}T02:00:00Z`,
}));
const events = Array.from({ length: 6 }, (_, index) => ({
  id: `e${index}`, title: `Community Tree Planting Activity at Barangay Sagrada ${index}`, eventDate: `2099-12-1${index}`,
  location: sites[0].name, status: "Upcoming", type: "Tree Planting",
}));
const monitoring = Array.from({ length: 10 }, (_, index) => ({
  id: `m${index}`, userId: uid, status: "Verified", siteId: `s${index % 8}`, siteName: sites[index % 8].name, barangay,
  aliveCount: 900 + index, deadCount: 100, survivalRate: 87.4, monitoringDate: `2026-10-2${index % 9}`, createdAt: `2026-10-2${index % 9}T02:00:00Z`,
}));
const responses = {
  "/api/seedling-requests": requests, "/api/seedling-requests/my": requests, "/api/sites": sites,
  "/api/planting-reports": reports, "/api/planting-reports/my-reports": reports, "/api/events": events,
  "/api/monitoring": monitoring, "/api/monitoring/my-records": monitoring,
  "/api/notifications/unread-count": { unreadCount: 2 },
  "/api/notifications": { notifications: [], unreadCount: 2, hasMore: false, nextCursor: null },
};

async function openDashboard(page, role, width, height = 900) {
  await page.setViewportSize({ width, height });
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (url.pathname === "/api/sites/barangay-boundaries") return route.fulfill({ json: { type: "FeatureCollection", features: [] } });
    return route.fulfill({ json: { success: true, data: responses[url.pathname] ?? [] } });
  });
  await page.goto(`/${role}/dashboard?role=${role}`);
  await page.locator(".dashboard-kpi-card").first().waitFor();
  await page.locator(role === "participant" ? ".activity-card" : ".sites-table").first().waitFor();
  await page.waitForTimeout(400);
}

const kpiRows = page => page.evaluate(() => {
  const grid = document.querySelector(".dashboard-kpi-grid").getBoundingClientRect();
  const rows = new Map();
  for (const card of document.querySelectorAll(".dashboard-kpi-card")) {
    const box = card.getBoundingClientRect(), top = Math.round(box.top);
    rows.set(top, Math.max(rows.get(top) ?? 0, box.right));
  }
  return { gridRight: grid.right, rowRights: [...rows.values()], rowCount: rows.size };
});

const allWidths = [1920, 1440, 1280, 1024, 768, 390, 360];
for (const [role, widths] of [["participant", allWidths], ["staff", allWidths], ["admin", [1440, 1280, 390]]]) {
  for (const width of widths) {
    test(`${role} KPI rows fill the grid at ${width}px`, async ({ page }) => {
      await openDashboard(page, role, width);
      const { gridRight, rowRights } = await kpiRows(page);
      for (const right of rowRights) expect(Math.abs(gridRight - right)).toBeLessThanOrEqual(1);
    });
  }
}

for (const width of [390, 360]) {
  test(`phone KPI cards sit two per row at ${width}px`, async ({ page }) => {
    await openDashboard(page, "staff", width, 844);
    expect((await kpiRows(page)).rowCount).toBe(3);
  });
}

for (const role of ["staff", "admin"]) {
  for (const width of [1920, 1440, 1280, 1024, 768]) {
    test(`${role} sites table cells never overlap at ${width}px`, async ({ page }) => {
      await openDashboard(page, role, width);
      const overlaps = await page.evaluate(() => {
        const textBox = cell => {
          const range = document.createRange();
          range.selectNodeContents(cell);
          return range.getBoundingClientRect();
        };
        const found = [];
        for (const row of document.querySelectorAll(".sites-table tr")) {
          const boxes = [...row.children].map(textBox);
          boxes.slice(1).forEach((box, index) => {
            if (box.left < boxes[index].right - 1) found.push(row.children[index + 1].textContent.trim());
          });
        }
        return found;
      });
      expect(overlaps).toEqual([]);
    });

    test(`${role} sites table shows every column without sideways scrolling at ${width}px`, async ({ page }) => {
      await openDashboard(page, role, width);
      const scroll = page.locator(".sites-table-card .table-scroll");
      expect(await scroll.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    });
  }

  for (const width of [390, 360]) {
    test(`${role} sites become labelled cards on phones at ${width}px`, async ({ page }) => {
      await openDashboard(page, role, width, 844);
      const scroll = page.locator(".sites-table-card .table-scroll");
      expect(await scroll.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
      await expect(page.locator(".sites-table thead")).toHaveCSS("position", "absolute");
      const label = await page.locator(".sites-table tbody tr").first().locator("td").nth(1)
        .evaluate(cell => getComputedStyle(cell, "::before").content);
      expect(label).toContain("Barangay");
    });

    test(`${role} phone site rows stay compact at ${width}px`, async ({ page }) => {
      await openDashboard(page, role, width, 844);
      const tallest = await page.locator(".sites-table tbody td").evaluateAll(cells => Math.max(...cells.map(cell => cell.getBoundingClientRect().height)));
      expect(tallest).toBeLessThanOrEqual(64);
    });
  }
}

const managementPanels = [".map-card", ".activity-card", ".dashboard-right-column"];
for (const [role, selectors] of [["staff", managementPanels], ["admin", managementPanels], ["participant", [".activity-card", ".dashboard-right-column"]]]) {
  test(`${role} top panels end on the same line at 1440px`, async ({ page }) => {
    await openDashboard(page, role, 1440);
    const bottoms = await page.evaluate(list => list.map(selector => document.querySelector(selector).getBoundingClientRect().bottom), selectors);
    expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(1);
  });
}

for (const width of [1440, 1280, 390]) {
  test(`recent activities rest on a whole row at ${width}px`, async ({ page }) => {
    await openDashboard(page, "staff", width);
    const cutOff = await page.locator(".recent-list").evaluate(list => {
      const bottom = list.getBoundingClientRect().top + list.clientHeight;
      return [...list.children].some(item => {
        const box = item.getBoundingClientRect();
        return box.top < bottom - 2 && box.bottom > bottom + 2;
      });
    });
    expect(cutOff).toBe(false);
  });
}

test("no empty column beside recent activities at 1280px", async ({ page }) => {
  await openDashboard(page, "staff", 1280);
  const gap = await page.evaluate(() => document.querySelector(".dashboard-right-column").getBoundingClientRect().right
    - document.querySelector(".recent-card").getBoundingClientRect().right);
  expect(gap).toBeLessThanOrEqual(1);
});

for (const role of ["participant", "staff", "admin"]) {
  for (const width of [1440, 768, 360]) {
    test(`${role} page never scrolls sideways at ${width}px`, async ({ page }) => {
      await openDashboard(page, role, width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    });
  }
}
