export const API_BASE_URL = "http://127.0.0.1:5184/api";

export class MenroApiError extends Error {}

export async function verifyMenroSession() {
  return { uid: "staff-fixture", role: "Staff" };
}

export function resetMenroSessionRequest() {}

export async function getAuthToken() {
  return "phase3c-test-token";
}

const baseVisit = {
  cohortId: "cohort-fixture",
  siteId: "site-fixture",
  visitDate: "2026-11-03",
  version: 4,
  samplingPlanVersion: 1,
  baselineVersion: 1,
  actions: { view: true, saveDraft: true, submit: true, review: false },
};
const draftVisit = { ...baseVisit, id: "VPMV-STAFF-001", status: "DRAFT", progress: { completed: 1, total: 2, rechecking: 1 } };
const returnedVisit = { ...baseVisit, id: "VPMV-STAFF-002", status: "RETURNED", progress: { completed: 2, total: 2, rechecking: 0 } };
const detail = {
  ...draftVisit,
  sampleAssessments: [
    { sampleId: "TREE-001", condition: "Healthy", remarks: "Stable growth.", assessmentRevision: 0, evidenceHistory: [], previousAssessmentReference: { condition: "Healthy" } },
    { sampleId: "TREE-002", condition: "Needs Rechecking", remarks: "Tag needs verification.", assessmentRevision: 0, evidenceHistory: [], recheckQueued: true },
  ],
};
const returnedDetail = {
  ...detail,
  id: "VPMV-RETURNED-001",
  status: "RETURNED",
  version: 7,
  sampleAssessments: detail.sampleAssessments.map((assessment) => ({
    ...assessment,
    assessmentRevision: assessment.sampleId === "TREE-001" ? 1 : 0,
    evidenceHistory: assessment.sampleId === "TREE-001"
      ? [{ revision: 0, privateEvidence: "server-only-reference" }]
      : [],
  })),
};
const approvedDetail = { ...detail, id: "VPMV-APPROVED-001", status: "APPROVED", version: 9 };
const pendingReviewDetail = {
  ...detail,
  id: "VPMV-PENDING-REVIEW-001",
  status: "PENDING_ADMIN_APPROVAL",
  version: 11,
  sampleAssessments: detail.sampleAssessments.map((assessment, index) => ({
    ...assessment,
    heightCentimeters: index === 0 ? 120 : 98,
    diameterCentimeters: index === 0 ? 6 : 5,
    investigationOutcome: index === 1 ? "Not Located After Rechecking" : null,
    searchFindings: index === 1 ? "Searched assigned sample area." : null,
    evidenceHistory: index === 0 ? [{ revision: 0, privateEvidence: "server-only-reference" }] : [],
  })),
  history: [{ version: 10, status: "DRAFT" }, { version: 11, status: "PENDING_ADMIN_APPROVAL" }],
};

const fixture = () => new URLSearchParams(window.location.search).get("fixture") || "default";
const response = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const failure = (status, message) => response(status, { success: false, message });

function listResponse(url, activeFixture) {
  if (activeFixture === "two-visits") return response(200, { success: true, data: { visits: [
    { ...returnedDetail, progress: { completed: 2, total: 2, rechecking: 0 } },
    { ...approvedDetail, progress: { completed: 2, total: 2, rechecking: 0 } },
  ], nextCursor: null } });
  if (activeFixture === "empty") return response(200, { success: true, data: { visits: [], nextCursor: null } });
  if (activeFixture === "discovery-401") return failure(401, "Credentials required.");
  if (activeFixture === "discovery-403") return failure(403, "Forbidden.");
  if (activeFixture === "discovery-500") return failure(500, "Discovery unavailable.");
  if (activeFixture === "detail-404") return response(200, { success: true, data: { visits: [{ ...draftVisit, id: "VPMV-DETAIL-ERROR" }], nextCursor: null } });
  if (activeFixture === "detail-500") return response(200, { success: true, data: { visits: [{ ...draftVisit, id: "VPMV-DETAIL-SERVER-ERROR" }], nextCursor: null } });
  if (activeFixture === "detail-401") return response(200, { success: true, data: { visits: [{ ...draftVisit, id: "VPMV-DETAIL-UNAUTHORIZED" }], nextCursor: null } });
  if (activeFixture === "detail-403") return response(200, { success: true, data: { visits: [{ ...draftVisit, id: "VPMV-DETAIL-FORBIDDEN" }], nextCursor: null } });
  if (activeFixture === "returned") return response(200, { success: true, data: { visits: [{ ...returnedVisit, id: returnedDetail.id }], nextCursor: null } });
  if (activeFixture === "approved") return response(200, { success: true, data: { visits: [{ ...draftVisit, id: approvedDetail.id, status: "APPROVED", actions: { view: true, saveDraft: false, submit: false, review: false } }], nextCursor: null } });
  if (["review-pending", "review-stale", "review-failure", "review-forbidden"].includes(activeFixture)) {
    return response(200, { success: true, data: { visits: [{ ...draftVisit, id: pendingReviewDetail.id, status: "PENDING_ADMIN_APPROVAL", version: pendingReviewDetail.version, actions: { view: true, saveDraft: false, submit: false, review: true } }], nextCursor: null } });
  }
  const status = url.searchParams.get("status");
  const cursor = url.searchParams.get("cursor");
  if (status === "RETURNED") return response(200, { success: true, data: { visits: [returnedVisit], nextCursor: null } });
  if (cursor === "VPMV-STAFF-001") return response(200, { success: true, data: { visits: [returnedVisit], nextCursor: null } });
  return response(200, { success: true, data: { visits: [draftVisit], nextCursor: "VPMV-STAFF-001" } });
}

function detailResponse(visitId, activeFixture) {
  if (activeFixture === "two-visits") {
    const source = visitId === returnedDetail.id ? returnedDetail : approvedDetail;
    return response(200, { success: true, data: { ...source, sampleAssessments: source.sampleAssessments.map((row, index) => ({
      ...row, evidenceHistory: index === 0 ? [{ revision: 0 }] : [],
    })) } });
  }
  if (activeFixture === "detail-404") return failure(404, "private://fixture-object");
  if (activeFixture === "detail-500") return failure(500, "Detail unavailable.");
  if (activeFixture === "detail-401") return failure(401, "Sign in is required.");
  if (activeFixture === "detail-403") return failure(403, "Access is forbidden.");
  const uploaded = window.__PHASE3C_EVIDENCE__ || {};
  const withEvidence = (source) => ({
    ...source,
    sampleAssessments: source.sampleAssessments.map((assessment) => ({
      ...assessment,
      evidenceHistory: [
        ...(assessment.evidenceHistory || []),
        ...(uploaded[`${source.id}:${assessment.sampleId}`] || []),
      ],
    })),
  });
  if (visitId === draftVisit.id) return response(200, { success: true, data: withEvidence(detail) });
  if (visitId === returnedDetail.id) return response(200, { success: true, data: withEvidence(returnedDetail) });
  if (visitId === approvedDetail.id) return response(200, { success: true, data: withEvidence(approvedDetail) });
  if (visitId === pendingReviewDetail.id) return response(200, { success: true, data: withEvidence(pendingReviewDetail) });
  if (visitId === returnedVisit.id) return response(200, { success: true, data: { ...returnedVisit, sampleAssessments: [] } });
  return failure(404, "Monitoring visit not found.");
}

function saveResponse(visitId, options, activeFixture) {
  if (activeFixture === "stale-save") return failure(409, "This monitoring visit is no longer editable.");
  const payload = JSON.parse(options.body || "{}");
  window.__PHASE3C_MUTATIONS__ = [...(window.__PHASE3C_MUTATIONS__ || []), { path: String(visitId), payload }];
  if (!Array.isArray(payload.assessments) || (payload.submit && payload.assessments.some((assessment) => !assessment.condition))) {
    return failure(409, "Every approved sample requires an assessment before submission.");
  }
  const source = visitId === returnedDetail.id ? returnedDetail : detail;
  const sampleAssessments = payload.assessments.map((assessment) => {
    const prior = source.sampleAssessments.find((item) => item.sampleId === assessment.sampleId) || {};
    const corrected = source.status === "RETURNED" && assessment.sampleId === "TREE-001";
    return {
      ...assessment,
      assessmentRevision: Number(prior.assessmentRevision || 0) + (corrected ? 1 : 0),
      evidenceHistory: prior.evidenceHistory || [],
    };
  });
  return response(200, { success: true, data: {
    ...source,
    status: payload.submit ? "PENDING_ADMIN_APPROVAL" : "DRAFT",
    version: Number(source.version) + 1,
    sampleAssessments,
    visitRemarks: payload.visitRemarks || "",
    dateMonitored: payload.dateMonitored,
  } });
}

function captureResponse(binding) {
  window.__PHASE3C_CAPTURE_BINDINGS__ = [...(window.__PHASE3C_CAPTURE_BINDINGS__ || []), binding];
  return response(201, { success: true, data: {
    captureSessionId: "capture-session-fixture",
    nonce: "fixture-nonce",
    expiresAt: "2026-11-03T00:05:00.000Z",
  } });
}

function uploadEvidenceResponse(url, options, activeFixture) {
  if (activeFixture === "stale-upload") return failure(409, "Assessment evidence changed while uploading.");
  const match = url.pathname.match(/^\/verified-sample-monitoring\/visits\/([^/]+)\/samples\/([^/]+)\/evidence$/);
  const visitId = decodeURIComponent(match[1]);
  const sampleId = decodeURIComponent(match[2]);
  const manifest = JSON.parse(options.body.get("evidenceManifest"));
  const revision = Number(options.body.get("assessmentRevision"));
  const expectedVisitVersion = Number(options.body.get("expectedVisitVersion"));
  window.__PHASE3C_UPLOADS__ = [...(window.__PHASE3C_UPLOADS__ || []), {
    visitId, sampleId, revision, expectedVisitVersion, manifest, idempotencyKey: options.headers?.["Idempotency-Key"],
  }];
  const key = `${visitId}:${sampleId}`;
  const current = window.__PHASE3C_EVIDENCE__ || {};
  window.__PHASE3C_EVIDENCE__ = {
    ...current,
    [key]: [...(current[key] || []), { revision, privateEvidence: "server-only-reference", captureSessionId: manifest[0].captureSessionId }],
  };
  return response(200, { success: true, data: { visitId, sampleId } });
}

function reviewResponse(visitId, options, activeFixture) {
  if (activeFixture === "review-stale") return failure(409, "Monitoring visit is not ready for review.");
  if (activeFixture === "review-failure") return failure(500, "Review service is unavailable.");
  if (activeFixture === "review-forbidden") return failure(403, "Forbidden");
  if (visitId !== pendingReviewDetail.id) return failure(404, "Monitoring visit not found.");
  const payload = JSON.parse(options.body || "{}");
  window.__PHASE3C_REVIEWS__ = [...(window.__PHASE3C_REVIEWS__ || []), { visitId, payload }];
  const status = payload.approve ? "APPROVED" : "RETURNED";
  return response(200, { success: true, data: {
    ...pendingReviewDetail,
    status,
    reviewReasons: String(payload.reasons || ""),
    history: [...pendingReviewDetail.history, { version: pendingReviewDetail.version, status }],
  } });
}

export async function authenticatedFetch(path, options = {}) {
  if (!String(path).startsWith("/verified-sample-monitoring/") && !String(path).startsWith("/evidence-capture-sessions") && !String(path).startsWith("/evidence/")) throw new Error(`Unregistered test API: ${path}`);
  window.__PHASE3C_REQUESTS__ = [...(window.__PHASE3C_REQUESTS__ || []), String(path)];
  const activeFixture = fixture();
  if (activeFixture === "network-error") throw new TypeError("Monitoring network unavailable.");
  if (activeFixture === "loading") await (window.__PHASE3C_DISCOVERY_GATE__ || new Promise((resolve) => window.setTimeout(resolve, 150)));
  const url = new URL(path, API_BASE_URL);
  if (url.pathname === "/evidence-capture-sessions" && options.method === "POST") {
    return captureResponse(JSON.parse(options.body || "{}"));
  }
  if (/^\/evidence-capture-sessions\/[^/]+\/verify$/.test(url.pathname) && options.method === "POST") {
    return response(200, { success: true, data: {
      verificationId: "verification-fixture",
      imageSha256: "fixture-sha256",
      location: { latitude: 12.5, longitude: 123.5, accuracy: 5 },
    } });
  }
  if (/^\/evidence\/sample-monitoring\/visits\/[^/]+\/samples\/[^/]+\/evidence\/\d+$/.test(url.pathname)) {
    if (activeFixture === "evidence-403") return failure(403, "Forbidden");
    return new Response("fixture-private-photo", { status: 200, headers: { "Content-Type": "image/jpeg" } });
  }
  if (/^\/verified-sample-monitoring\/visits\/[^/]+\/samples\/[^/]+\/evidence$/.test(url.pathname) && options.method === "PUT") {
    return uploadEvidenceResponse(url, options, activeFixture);
  }
  if (/^\/verified-sample-monitoring\/visits\/[^/]+\/review$/.test(url.pathname) && options.method === "POST") {
    return reviewResponse(decodeURIComponent(url.pathname.split("/")[3]), options, activeFixture);
  }
  if (url.pathname === "/verified-sample-monitoring/visits") return listResponse(url, activeFixture);
  const detailMatch = url.pathname.match(/^\/verified-sample-monitoring\/visits\/([^/]+)$/);
  if (detailMatch) {
    const visitId = decodeURIComponent(detailMatch[1]);
    if (options.method === "PUT") return saveResponse(visitId, options, activeFixture);
    return detailResponse(visitId, activeFixture);
  }
  throw new Error(`Unregistered test API: ${path}`);
}

export async function publicApiFetch(path) {
  throw new Error(`Unregistered test API: ${path}`);
}

export async function authenticatedJson(path, options = {}) {
  const response = await authenticatedFetch(path, options);
  return { response, body: await response.json().catch(() => null) };
}
