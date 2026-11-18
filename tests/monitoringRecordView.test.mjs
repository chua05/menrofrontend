import test from "node:test";
import assert from "node:assert/strict";
import { MONITORING_ID_NOT_ASSIGNED, hasMonitoringId, monitoringDisplayId } from "../src/utils/monitoringRecordView.js";

test("only a backend-assigned sequential MON-YYYY-NNN number is shown as the Monitoring ID", () => {
  assert.equal(monitoringDisplayId({ monitoringNumber: "MON-2026-004" }), "MON-2026-004");
  assert.equal(monitoringDisplayId({ monitoringNumber: "mon-2026-1234" }), "MON-2026-1234");
  // Document IDs (MON-<hash>), legacy IDs and missing numbers never become a display ID.
  for (const record of [{ id: "MON-0a1b2c3d4e5f60718293" }, { monitoringNumber: "MON-AB12CD3" }, { monitoringId: "MON-2026-001" }, {}, null])
    assert.equal(monitoringDisplayId(record), MONITORING_ID_NOT_ASSIGNED, JSON.stringify(record));
  assert.equal(hasMonitoringId({ monitoringNumber: "MON-2026-010" }), true);
  assert.equal(hasMonitoringId({ id: "MON-0a1b2c3d4e5f60718293" }), false);
});
