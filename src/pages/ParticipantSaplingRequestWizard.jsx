import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Minus,
  Plus,
  Sprout,
  Upload,
  X,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authenticatedFetch, API_BASE_URL } from "../services/authenticatedApi";
import { BULAN_BARANGAYS } from "../utils/userTypes";
import { IDENTIFICATION_DOCUMENTS } from "../utils/identificationDocuments";
import {
  canNavigateToStep,
  EXACT_AREA_CHOICES,
  getPlantingAreaError,
  getPlantingAreaHectares,
  getStepState,
  invalidateCompletedSteps,
  isGroupRequester,
  validateRequestLetterFile,
} from "../utils/saplingRequestWorkflow";

const API = API_BASE_URL;
const BARANGAY_GEOJSON_URL = `${API}/sites/barangay-boundaries`;
const BULAN_CENTER = [12.6598, 123.918];
const STEPS = [
  "Requester & Address",
  "Request Details",
  "Planting Information",
  "Identification & Review",
];
const SECTORS = [
  "Resident / Individual",
  "Barangay Official",
  "School / Student",
  "Private Sector / Business",
  "Civic Organization / NGO",
  "Government Agency",
  "Other (please specify)",
];
const PURPOSES = [
  "Tree Planting Activity",
  "Reforestation / Rehabilitation",
  "School Activity",
  "Barangay Activity",
  "Community Activity",
  "Replacement Planting",
  "Environmental Program",
  "Personal Planting",
  "Other",
];
const AREAS = [
  "Less than 1 hectare",
  "1 hectare",
  "2 hectares",
  "3 hectares",
  "4 hectares",
  "5 hectares",
  "6–10 hectares",
  "More than 10 hectares",
  "Other / Exact Area",
];
const LAND = [
  "Open / Vacant Land",
  "Grassland",
  "Agricultural Land",
  "Residential / Private Property",
  "School / Institutional Grounds",
  "Government Property",
  "Barangay / Community Property",
  "Riverbank / Watershed Area",
  "Coastal Area",
  "Other",
  "Not Sure",
];
const COVERAGE_TYPE = "generated_estimated_coverage";
const LOCATION_SOURCE = "participant_map_selection";
const SITE_VERIFICATION_STATUS = "pending_review";
const hectaresFromForm = (form) =>
  getPlantingAreaHectares(form.areaChoice, form.exactArea);
const pointInRing = ([lng, lat], ring = []) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    if (
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    )
      inside = !inside;
  }
  return inside;
};
const pointInPolygon = (point, coordinates = []) =>
  Boolean(
    coordinates[0] &&
      pointInRing(point, coordinates[0]) &&
      !coordinates.slice(1).some((ring) => pointInRing(point, ring)),
  );
const geometryContainsPoint = (geometry, point) =>
  geometry?.type === "Polygon"
    ? pointInPolygon(point, geometry.coordinates)
    : geometry?.type === "MultiPolygon"
      ? geometry.coordinates.some((polygon) => pointInPolygon(point, polygon))
      : false;
const destinationPoint = (lat, lng, distanceMeters, bearingDegrees) => {
  const radius = 6371008.8,
    angular = distanceMeters / radius,
    bearing = (bearingDegrees * Math.PI) / 180,
    lat1 = (lat * Math.PI) / 180,
    lng1 = (lng * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );
  return [(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
};
const validateCoverage = (feature, lat, lng, hectares) => {
  if (
    !feature ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !(hectares > 0)
  )
    return "pending";
  if (!geometryContainsPoint(feature.geometry, [lng, lat])) return "outside";
  const radius = Math.sqrt((hectares * 10000) / Math.PI);
  for (let bearing = 0; bearing < 360; bearing += 5) {
    if (
      !geometryContainsPoint(
        feature.geometry,
        destinationPoint(lat, lng, radius, bearing),
      )
    )
      return "crosses";
  }
  return "valid";
};
const fresh = (p) => ({
  fullName: p?.fullName || p?.name || "",
  contactNumber: p?.contactNumber || "",
  sector: "",
  sectorOther: "",
  requestingAs: "",
  addressBarangay: "",
  street: "",
  purpose: "",
  purposeOther: "",
  trees: [{ id: crypto.randomUUID(), inventoryId: "", quantity: "" }],
  preferredReleaseDate: "",
  siteMode: "existing",
  siteBarangay: "",
  existingSiteId: "",
  areaChoice: "",
  exactArea: "",
  siteName: "",
  specificLocation: "",
  latitude: "",
  longitude: "",
  siteNotes: "",
  niyogan: "",
  landType: "",
  landTypeOther: "",
  currentCondition: "",
  releaseMethod: "",
  eventName: "",
  activityDate: "",
  startTime: "",
  endTime: "",
  participants: "",
  requestLetter: null,
  caretaker: "",
  carePlan: "",
  monitoringFrequency: "",
  monitoringOther: "",
  identificationType: "",
  idNumber: "",
  schoolInstitutionName: "",
  confirmed: false,
});
async function api(path, options = {}) {
  const response = await authenticatedFetch(path, options);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.message || "Unable to complete the request.");
    error.status = response.status;
    throw error;
  }
  return body?.data ?? body;
}

function submissionErrorMessage(error) {
  if (error?.name === "AbortError") {
    return "The request is taking longer than expected. Its status is uncertain; check My Requests before trying again.";
  }
  if (error?.status === 401) return "Your session has expired. Please sign in again and retry.";
  if (error?.status === 403) return "Your account is not authorized to submit this request.";
  if (error?.status === 503) return "Request submission is temporarily unavailable. Please contact MENRO.";
  if (!navigator.onLine || error instanceof TypeError) {
    return "Unable to reach MENRO. Check your connection, then check My Requests before retrying.";
  }
  return error?.message || "An unexpected error prevented the request from being submitted.";
}
function Field({ label, error, children, wide }) {
  return (
    <label className={`sr-form-field ${wide ? "full-width" : ""}`}>
      <span>{label}</span>
      {children}
      {error && <small className="sr-field-error">{error}</small>}
    </label>
  );
}
function Title({ children, help }) {
  return (
    <div className="participant-section-title">
      <div>
        <h3>{children}</h3>
        {help && <p>{help}</p>}
      </div>
    </div>
  );
}
function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) return "File selected";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
function RequestLetterUpload({ file, error, onSelect, onRemove }) {
  const input = useRef(null);
  const [dragging, setDragging] = useState(false);
  const choose = () => input.current?.click();
  const acceptDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    onSelect(event.dataTransfer.files?.[0] || null);
  };
  const hiddenInput = (
    <input
      ref={input}
      className="sr-request-letter-input"
      type="file"
      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
      onClick={(event) => {
        event.currentTarget.value = "";
      }}
      onChange={(event) => onSelect(event.target.files?.[0] || null)}
    />
  );
  return (
    <div className="sr-request-letter-field">
      <span className="sr-request-letter-label">Request Letter *</span>
      {file ? (
        <div className="sr-request-letter-selected">
          {hiddenInput}
          <FileText size={24} aria-hidden="true" />
          <div>
            <strong>{file.name || "Request letter"}</strong>
            <span>{formatFileSize(file.size)}</span>
          </div>
          <div className="sr-request-letter-actions">
            <button type="button" onClick={choose}>Replace</button>
            <button type="button" onClick={onRemove}><X size={14} aria-hidden="true" /> Remove</button>
          </div>
        </div>
      ) : (
        <div
          className={`sr-request-letter-dropzone ${dragging ? "dragging" : ""} ${error ? "invalid" : ""}`}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
          onDrop={acceptDrop}
        >
          {hiddenInput}
          <button type="button" className="sr-request-letter-picker" onClick={choose}>
            <Upload size={25} aria-hidden="true" />
            <strong>Click to upload or drag and drop</strong>
            <span>PDF, JPG, JPEG or PNG</span>
            <small>Max 10 MB</small>
          </button>
        </div>
      )}
      {error && <small className="sr-field-error">{error}</small>}
    </div>
  );
}
function Radios({ name, value, set, items }) {
  return (
    <>
      <div className="sr-wizard-radios">
        {items.map(([v, l]) => (
          <label key={v}>
            <input
              type="radio"
              name={name}
              checked={value === v}
              onChange={() => set(v)}
            />
            <span>{l}</span>
          </label>
        ))}
      </div>
      {name === "niyogan" && value === "yes" && (
        <div className="sr-niyogan-block" role="alert">
          <strong>Planting Location Not Eligible</strong>
          <p>
            The proposed planting area is identified as a coconut farm
            (Niyogan). Please provide another planting location to continue.
          </p>
          <button
            type="button"
            className="sr-secondary-btn"
            onClick={() =>
              document
                .getElementById("proposed-planting-map")
                ?.scrollIntoView({ behavior: "smooth", block: "center" })
            }
          >
            Change Planting Location
          </button>
        </div>
      )}
      {name === "niyogan" && value === "no" && (
        <p className="sr-niyogan-status">For MENRO Site Review</p>
      )}
      {name === "niyogan" && value === "unsure" && (
        <p className="sr-niyogan-status">
          Niyogan Status: Requires MENRO Verification
        </p>
      )}
    </>
  );
}

export default function ParticipantSaplingRequestWizard({ currentUser }) {
  const navigate = useNavigate(),
    [params] = useSearchParams(),
    editId = params.get("edit") || "";
  const [step, setStep] = useState(1),
    [highestUnlockedStep, setHighestUnlockedStep] = useState(1),
    [completedSteps, setCompletedSteps] = useState(() => new Set()),
    [form, setForm] = useState(() => fresh(currentUser)),
    [inventory, setInventory] = useState([]),
    [sites, setSites] = useState([]),
    [editing, setEditing] = useState(null),
    [errors, setErrors] = useState({}),
    [loading, setLoading] = useState(true),
    [submitting, setSubmitting] = useState(false),
    [notice, setNotice] = useState(""),
    [mapValidation, setMapValidation] = useState("pending");
  const submissionId = useRef(crypto.randomUUID());
  const group = isGroupRequester(form.sector, form.requestingAs);
  const chosenSite = sites.find((x) => x.id === form.existingSiteId);
  const siteOptions = useMemo(
    () =>
      sites.filter(
        (x) =>
          String(x.barangay || "").toLowerCase() ===
            form.siteBarangay.toLowerCase() &&
          String(x.status || "active").toLowerCase() === "active",
      ),
    [sites, form.siteBarangay],
  );
  const put = (key, value) => {
    setCompletedSteps((current) => {
      if (!current.has(step)) return current;
      return invalidateCompletedSteps(
        current,
        step,
        ["sector", "requestingAs"].includes(key),
      );
    });
    setForm((old) => {
      const requestingAs =
        key === "requestingAs"
          ? value
          : key === "sector" && value !== "Other (please specify)"
            ? ""
            : old.requestingAs;
      const sector = key === "sector" ? value : old.sector;
      const nextIsGroup = isGroupRequester(sector, requestingAs);
      return {
        ...old,
        [key]: value,
        requestingAs,
        ...(key === "siteMode"
          ? {
              existingSiteId: "",
              siteName: "",
              specificLocation: "",
              latitude: "",
              longitude: "",
              niyogan: "",
              landType: "",
              landTypeOther: "",
              currentCondition: "",
            }
          : {}),
        ...(["latitude", "longitude"].includes(key)
          ? {
              niyogan: "",
              landType: "",
              landTypeOther: "",
              currentCondition: "",
            }
          : {}),
        ...(key === "landType" && value !== "Other"
          ? { landTypeOther: "" }
          : {}),
        ...(key === "monitoringFrequency" && value !== "Other"
          ? { monitoringOther: "" }
          : {}),
        ...(key === "areaChoice" && !EXACT_AREA_CHOICES.has(value)
          ? { exactArea: "" }
          : {}),
        ...(!nextIsGroup
          ? { eventName: "", endTime: "", requestLetter: null }
          : {}),
      };
    });
    setErrors((old) => ({
      ...old,
      [key]: "",
      ...(["sector", "requestingAs"].includes(key)
        ? { eventName: "", endTime: "", participants: "", requestLetter: "" }
        : {}),
      ...(key === "areaChoice" ? { exactArea: "" } : {}),
      ...(key === "landType" ? { landTypeOther: "" } : {}),
      ...(key === "monitoringFrequency" ? { monitoringOther: "" } : {}),
      ...(["latitude", "longitude"].includes(key)
        ? { niyogan: "", landType: "", currentCondition: "" }
        : {}),
    }));
  };
  useEffect(() => {
    Promise.all([
      api("/inventory/available"),
      api("/sites"),
      api("/auth/profile"),
      editId ? api(`/seedling-requests/${encodeURIComponent(editId)}`) : null,
    ])
      .then(([stock, allSites, profile, request]) => {
        setInventory(stock || []);
        setSites(allSites?.data || allSites || []);
        setEditing(request);
        if (request)
          setForm({
            ...fresh(profile),
            ...(request.workflow || {}),
            fullName: request.participantName || profile.fullName,
            contactNumber: request.contactNumber || profile.contactNumber,
            trees: (request.items || []).map((x) => ({
              id: crypto.randomUUID(),
              inventoryId: x.inventoryId,
              quantity: x.quantity,
            })),
            idNumber: "",
            confirmed: false,
          });
        else setForm(fresh(profile));
      })
      .catch((e) => setNotice(e.message))
      .finally(() => setLoading(false));
  }, [editId]);
  const handleMapValidation = (status) => {
    setMapValidation(status);
    if (status === "valid") {
      setErrors((current) => ({ ...current, location: "" }));
    }
  };
  const validate = (s) => {
    const e = {};
    const need = (k, m = "This field is required.") => {
      if (!String(form[k] ?? "").trim()) e[k] = m;
    };
    if (s === 1) {
      need("sector", "Select a sector.");
      need("addressBarangay", "Select a barangay.");
      need("street", "Enter the request address.");
      if (form.sector === "Other (please specify)") {
        need("sectorOther");
        need("requestingAs", "Select how you are requesting.");
      }
    }
    if (s === 2) {
      need("purpose", "Select a purpose.");
      if (form.purpose === "Other") need("purposeOther");
      const ids = form.trees.map((x) => x.inventoryId).filter(Boolean);
      if (
        form.trees.some(
          (x) =>
            !x.inventoryId ||
            !Number.isInteger(Number(x.quantity)) ||
            Number(x.quantity) < 1,
        )
      )
        e.trees = "Select each tree and enter a positive whole quantity.";
      else if (new Set(ids).size !== ids.length)
        e.trees = "The same sapling cannot be selected more than once.";
      need("preferredReleaseDate", "Select a preferred release date.");
      if (
        form.preferredReleaseDate &&
        form.preferredReleaseDate < new Date().toLocaleDateString("en-CA")
      )
        e.preferredReleaseDate =
          "Preferred release date cannot be in the past. Please select today or a future date.";
    }
    if (s === 3) {
      need("siteBarangay", "Select a barangay.");
      const areaError = getPlantingAreaError(
        form.areaChoice,
        form.exactArea,
      );
      if (areaError) {
        if (!form.areaChoice) e.areaChoice = areaError;
        else e.exactArea = areaError;
      }
      if (form.siteMode === "existing")
        need("existingSiteId", "Select a planting site.");
      else {
        [
          "siteName",
          "specificLocation",
          "latitude",
          "longitude",
          "niyogan",
        ].forEach((k) => need(k));
        if (mapValidation === "outside")
          e.location =
            "The selected location is outside the selected barangay boundary.";
        else if (mapValidation === "crosses")
          e.location =
            "The proposed planting area extends beyond the selected barangay boundary.";
        else if (mapValidation !== "valid")
          e.location = "Select a valid planting location on the map.";
        if (form.niyogan === "yes")
          e.niyogan =
            "Planting Location Not Eligible. Please provide another planting location to continue.";
        if (["no", "unsure"].includes(form.niyogan)) {
          need("landType", "Select a land / area type.");
          if (form.landType === "Other")
            need("landTypeOther", "Describe the type of land or area.");
          need("currentCondition", "Describe the current condition or use.");
        }
      }
      need("releaseMethod", "Select a preferred release method.");
      need("activityDate", "Select a planting date.");
      if (group) {
        need("eventName", "Enter an event name.");
        need("startTime");
        need("endTime");
        if (form.startTime && form.endTime && form.endTime <= form.startTime)
          e.endTime = "End time must be later than start time.";
        if (!(Number(form.participants) > 0))
          e.participants = "Enter expected participants.";
      }
      need("caretaker");
      need("carePlan");
      need("monitoringFrequency", "Select a monitoring frequency.");
      if (form.monitoringFrequency === "Other")
        need("monitoringOther", "Specify the monitoring frequency.");
    }
    if (s === 4 && !editing) {
      need("identificationType", "Select identification type.");
      need("idNumber", "Enter the ID number.");
      if (form.identificationType === "school_id")
        need("schoolInstitutionName");
    }
    if (s === 4 && group && !form.requestLetter)
      e.requestLetter = "Upload a request letter.";
    if (s === 4 && !form.confirmed)
      e.confirmed = "Please confirm the information.";
    setErrors(e);
    return !Object.keys(e).length;
  };
  const next = () => {
    if (validate(step)) {
      setCompletedSteps((current) => new Set(current).add(step));
      setHighestUnlockedStep((current) => Math.max(current, step + 1));
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const handleRequestLetter = (file) => {
    if (!file) return;
    const fileError = validateRequestLetterFile(file);
    if (fileError) {
      setErrors((current) => ({
        ...current,
        requestLetter: fileError,
      }));
      return;
    }
    put("requestLetter", file);
  };
  const submit = async () => {
    if (submitting || !validate(4)) return;
    setNotice("");
    setSubmitting(true);
    const location =
      form.siteMode === "existing"
        ? `${chosenSite?.locationDescription || ""}, ${form.siteBarangay}, Bulan, Sorsogon`
        : `${form.specificLocation}, ${form.siteBarangay}, Bulan, Sorsogon`;
    const workflow = {
      ...form,
      ...(form.siteMode === "proposed"
        ? {
            plantingAreaHectares: hectaresFromForm(form),
            locationSource: LOCATION_SOURCE,
            coverageType: COVERAGE_TYPE,
            siteVerificationStatus: SITE_VERIFICATION_STATUS,
          }
        : {}),
      requestLetter: form.requestLetter
        ? {
            name: form.requestLetter.name,
            type: form.requestLetter.type,
            size: form.requestLetter.size,
          }
        : null,
    };
    if (!group) {
      workflow.eventName = "";
      workflow.endTime = "";
      workflow.requestLetter = null;
    }
    if (form.siteMode === "existing") {
      workflow.niyogan = "";
      workflow.landType = "";
      workflow.landTypeOther = "";
      workflow.currentCondition = "";
    }
    if (!editing && form.siteMode === "proposed") delete workflow.siteNotes;
    delete workflow.trees;
    delete workflow.idNumber;
    const payload = {
      items: form.trees.map((x) => ({
        inventoryId: x.inventoryId,
        quantity: Number(x.quantity),
      })),
      purpose: form.purpose === "Other" ? form.purposeOther : form.purpose,
      plantingLocation: location,
      preferredReleaseDate: form.preferredReleaseDate,
      workflow,
      eventProposal: {
        eventName: group ? form.eventName : `Individual planting schedule`,
        barangay: form.siteBarangay,
        plantingSiteId: form.existingSiteId || "PROPOSED",
        proposedDate: form.activityDate,
        startTime: form.startTime || "08:00",
        endTime: form.endTime || "09:00",
        eventLocation: location,
        latitude: Number(
          form.siteMode === "existing" ? chosenSite?.latitude : form.latitude,
        ),
        longitude: Number(
          form.siteMode === "existing" ? chosenSite?.longitude : form.longitude,
        ),
        expectedParticipants: Number(form.participants || 1),
        eventDescription: "",
      },
      ...(!editing
        ? {
            clientSubmissionId: submissionId.current,
            identification: {
              identificationType: form.identificationType,
              idNumber: form.idNumber,
              schoolInstitutionName: form.schoolInstitutionName,
              confirmed: true,
            },
          }
        : {}),
    };
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30000);
    try {
      const savedRequest = await api(
        editing
          ? `/seedling-requests/${encodeURIComponent(editing.id)}/resubmit`
          : "/seedling-requests",
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify(payload),
          signal: controller.signal,
        },
      );
      const requestReference = savedRequest?.requestNumber || savedRequest?.id;
      navigate("/participant/my-requests", {
        replace: true,
        state: {
          submissionMessage: editing
            ? `Your sapling request ${requestReference} was resubmitted successfully. Status: Pending Review.`
            : `Your sapling request has been submitted successfully. Request Reference: ${requestReference}. Status: Pending Review.`,
        },
      });
    } catch (e) {
      setNotice(submissionErrorMessage(e));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      window.clearTimeout(timeoutId);
      setSubmitting(false);
    }
  };
  if (loading && !form.fullName)
    return (
      <div className="seedling-requests-page">Loading request form...</div>
    );
  return (
    <div className="seedling-requests-page participant-seedling-page">
      <section className="sr-page-header participant-request-header">
        <div className="sr-title-wrap">
          <div className="sr-title-icon">
            <Sprout size={21} />
          </div>
          <div>
            <h1>{editing ? "Edit Sapling Request" : "Request Saplings"}</h1>
            <p>Complete the four steps to submit your request.</p>
          </div>
        </div>
      </section>
      {notice && (
        <div className="sr-api-error" role="alert">
          {notice}
        </div>
      )}
      <section className="sr-record-card participant-request-card">
        <ol className="sr-request-stepper">
          {STEPS.map((name, index) => {
            const stepNumber = index + 1;
            const state = getStepState(
              stepNumber,
              step,
              completedSteps,
              highestUnlockedStep,
            );
            const clickable = canNavigateToStep(
              stepNumber,
              step,
              highestUnlockedStep,
            );
            const content = (
              <>
                <span>{state === "complete" ? <Check size={16} /> : stepNumber}</span>
                <strong>{name}</strong>
              </>
            );
            return (
              <li key={name} className={state}>
                {clickable ? (
                  <button type="button" onClick={() => setStep(stepNumber)}>
                    {content}
                  </button>
                ) : (
                  <div aria-current={state === "current" ? "step" : undefined}>
                    {content}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <form
          className="sr-modal-body participant-request-form"
          onSubmit={(e) => e.preventDefault()}
        >
          {step === 1 && (
            <>
              <Title help="Your account information is used for this request.">
                Requester Information
              </Title>
              <div className="sr-form-grid">
                <Field label="Full Name *">
                  <input value={form.fullName} readOnly />
                </Field>
                <Field label="Sector *" error={errors.sector}>
                  <select
                    value={form.sector}
                    onChange={(e) => put("sector", e.target.value)}
                  >
                    <option value="">Select the group you represent</option>
                    {SECTORS.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                {form.sector === "Other (please specify)" && (
                  <>
                    <Field label="Please Specify *" error={errors.sectorOther}>
                      <input
                        value={form.sectorOther}
                        onChange={(e) => put("sectorOther", e.target.value)}
                      />
                    </Field>
                    <Field label="Requesting As *" error={errors.requestingAs}>
                      <Radios
                        name="requestingAs"
                        value={form.requestingAs}
                        set={(v) => put("requestingAs", v)}
                        items={[
                          ["individual", "Individual"],
                          ["group", "Group / Organization"],
                        ]}
                      />
                    </Field>
                  </>
                )}
                <Field label="Contact Number *">
                  <input value={form.contactNumber} readOnly />
                </Field>
              </div>
              <Title>Address Information</Title>
              <div className="sr-form-grid">
                <Field label="Barangay *" error={errors.addressBarangay}>
                  <SelectBarangay
                    value={form.addressBarangay}
                    set={(v) => put("addressBarangay", v)}
                  />
                </Field>
                <Field label="Municipality">
                  <input value="Bulan" readOnly />
                </Field>
                <Field label="Province">
                  <input value="Sorsogon" readOnly />
                </Field>
                <Field label="Street / Purok / Sitio *" error={errors.street}>
                  <input
                    value={form.street}
                    onChange={(e) => put("street", e.target.value)}
                    placeholder="Enter street, purok, sitio, or specific address"
                  />
                </Field>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <Title>Request Details</Title>
              <div className="sr-form-grid">
                <Field label="Purpose of Request *" error={errors.purpose}>
                  <select
                    value={form.purpose}
                    onChange={(e) => put("purpose", e.target.value)}
                  >
                    <option value="">Select purpose</option>
                    {PURPOSES.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                {form.purpose === "Other" && (
                  <Field label="Please Specify *" error={errors.purposeOther}>
                    <input
                      value={form.purposeOther}
                      onChange={(e) => put("purposeOther", e.target.value)}
                    />
                  </Field>
                )}
              </div>
              <Title help="Add the tree species and quantity you are requesting.">
                Saplings Requested
              </Title>
              <div className="sr-tree-section participant-tree-section">
                {form.trees.map((tree) => (
                  <div className="sr-tree-row" key={tree.id}>
                    <select
                      value={tree.inventoryId}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          trees: p.trees.map((x) =>
                            x.id === tree.id
                              ? { ...x, inventoryId: e.target.value }
                              : x,
                          ),
                        }))
                      }
                    >
                      <option value="">Select tree</option>
                      {inventory.map((x) => (
                        <option
                          key={x.id}
                          value={x.id}
                          disabled={form.trees.some(
                            (y) => y.id !== tree.id && y.inventoryId === x.id,
                          )}
                        >
                          {x.species} —{" "}
                          {Number(
                            x.currentQuantity ?? x.availableQuantity ?? 0,
                          )}{" "}
                          available
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Quantity"
                      value={tree.quantity}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          trees: p.trees.map((x) =>
                            x.id === tree.id
                              ? { ...x, quantity: e.target.value }
                              : x,
                          ),
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="sr-remove-tree"
                      disabled={form.trees.length === 1}
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          trees: p.trees.filter((x) => x.id !== tree.id),
                        }))
                      }
                    >
                      <Minus size={15} />
                    </button>
                  </div>
                ))}
                {errors.trees && (
                  <small className="sr-field-error">{errors.trees}</small>
                )}
                <button
                  type="button"
                  className="sr-add-tree"
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      trees: [
                        ...p.trees,
                        {
                          id: crypto.randomUUID(),
                          inventoryId: "",
                          quantity: "",
                        },
                      ],
                    }))
                  }
                >
                  <Plus size={14} /> Add Another Tree
                </button>
              </div>
              <Title help="Select your preferred date for the release of the saplings.">
                Preferred Release Date
              </Title>
              <Field
                label="Preferred Release Date *"
                error={errors.preferredReleaseDate}
              >
                <input
                  type="date"
                  min={new Date().toLocaleDateString("en-CA")}
                  value={form.preferredReleaseDate}
                  onChange={(e) => put("preferredReleaseDate", e.target.value)}
                />
              </Field>
            </>
          )}
          {step === 3 && (
            <>
              <Title help="Provide information about where the requested saplings will be planted.">
                Planting Information
              </Title>
              <Field label="Planting Site *">
                <Radios
                  name="siteMode"
                  value={form.siteMode}
                  set={(v) => put("siteMode", v)}
                  items={[
                    ["existing", "Select Existing Planting Site"],
                    ["proposed", "Propose New Planting Site"],
                  ]}
                />
              </Field>
              <div className="sr-form-grid">
                <Field label="Barangay *" error={errors.siteBarangay}>
                  <SelectBarangay
                    value={form.siteBarangay}
                    set={(v) => put("siteBarangay", v)}
                  />
                </Field>
                {form.siteMode === "existing" ? (
                  <Field label="Planting Site *" error={errors.existingSiteId}>
                    <select
                      value={form.existingSiteId}
                      onChange={(e) => put("existingSiteId", e.target.value)}
                    >
                      <option value="">Select planting site</option>
                      {siteOptions.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.siteId || x.id} — {x.siteName || x.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <>
                    <Field label="Site Name *" error={errors.siteName}>
                      <input
                        value={form.siteName}
                        onChange={(e) => put("siteName", e.target.value)}
                      />
                    </Field>
                    <Field
                      label="Specific Location / Address *"
                      error={errors.specificLocation}
                      wide
                    >
                      <input
                        value={form.specificLocation}
                        onChange={(e) =>
                          put("specificLocation", e.target.value)
                        }
                      />
                    </Field>
                  </>
                )}
                {form.siteMode === "proposed" ? (
                  <>
                    <Field
                      label="Planting Area (hectares) *"
                      error={errors.areaChoice}
                      wide
                    >
                      <select
                        value={form.areaChoice}
                        onChange={(e) => put("areaChoice", e.target.value)}
                      >
                        <option value="">Select area</option>
                        {AREAS.map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </Field>
                    {EXACT_AREA_CHOICES.has(form.areaChoice) && (
                      <Field
                        label="Exact Planting Area (hectares) *"
                        error={errors.exactArea}
                        wide
                      >
                        <input
                          type="number"
                          min={
                            form.areaChoice === "6–10 hectares"
                              ? "6"
                              : form.areaChoice === "More than 10 hectares"
                                ? "10.01"
                                : "0.01"
                          }
                          max={
                            form.areaChoice === "Less than 1 hectare"
                              ? "0.99"
                              : form.areaChoice === "6–10 hectares"
                                ? "10"
                                : undefined
                          }
                          step="0.01"
                          value={form.exactArea}
                          onChange={(e) => put("exactArea", e.target.value)}
                          placeholder={
                            form.areaChoice === "Other / Exact Area"
                              ? "2.5"
                              : "Enter exact hectares"
                          }
                        />
                      </Field>
                    )}
                  </>
                ) : (
                  <Field label="Planting Area *" error={errors.areaChoice}>
                    <select
                      value={form.areaChoice}
                      onChange={(e) => put("areaChoice", e.target.value)}
                    >
                      <option value="">Select area</option>
                      {AREAS.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
              <Title
                help={
                  form.siteMode === "proposed"
                    ? "Click or drag the marker to set the center of the estimated proposed planting coverage."
                    : "The registered site location is authoritative."
                }
              >
                Location Preview
              </Title>
              <LocationMap
                barangay={form.siteBarangay}
                site={
                  form.siteMode === "existing"
                    ? chosenSite
                    : { latitude: form.latitude, longitude: form.longitude }
                }
                editable={form.siteMode === "proposed"}
                areaHectares={
                  form.siteMode === "proposed" ? hectaresFromForm(form) : 0
                }
                onValidationChange={handleMapValidation}
                onPick={(lat, lng) => {
                  put("latitude", lat.toFixed(6));
                  put("longitude", lng.toFixed(6));
                }}
              />
              {form.siteMode === "proposed" && (
                <>
                  <Title>Selected Coordinates</Title>
                  <div className="sr-form-grid">
                    <Field label="Latitude">
                      <input value={form.latitude} readOnly />
                    </Field>
                    <Field label="Longitude">
                      <input value={form.longitude} readOnly />
                    </Field>
                  </div>
                  <ProposedCoverageSummary
                    form={form}
                    status={mapValidation}
                  />
                  {errors.location && (
                    <small className="sr-field-error">{errors.location}</small>
                  )}
                  {mapValidation === "valid" && (
                    <>
                      <Field
                        label="Is the proposed planting area registered or currently used as a coconut farm (Niyogan)? *"
                        error={errors.niyogan}
                      >
                        <Radios
                          name="niyogan"
                          value={form.niyogan}
                          set={(v) => put("niyogan", v)}
                          items={[
                            ["yes", "Yes"],
                            ["no", "No"],
                            ["unsure", "Not Sure"],
                          ]}
                        />
                      </Field>
                      {["no", "unsure"].includes(form.niyogan) && (
                        <div className="sr-form-grid">
                          <Field
                            label={
                              form.niyogan === "no"
                                ? "What type of land or area is the proposed planting location? *"
                                : "What best describes the proposed planting area? *"
                            }
                            error={errors.landType}
                          >
                            <select
                              value={form.landType}
                              onChange={(e) => put("landType", e.target.value)}
                            >
                              <option value="">Select best description</option>
                              {LAND.filter(
                                (x) =>
                                  form.niyogan === "unsure" || x !== "Not Sure",
                              ).map((x) => (
                                <option key={x}>{x}</option>
                              ))}
                            </select>
                          </Field>
                          {form.landType === "Other" && (
                            <Field
                              label="Please Specify *"
                              error={errors.landTypeOther}
                            >
                              <input
                                value={form.landTypeOther}
                                onChange={(e) =>
                                  put("landTypeOther", e.target.value)
                                }
                                placeholder="Describe the type of land or area"
                              />
                            </Field>
                          )}
                          <Field
                            label={
                              form.niyogan === "no"
                                ? "Describe the current condition or use of the area. *"
                                : "Describe what you know about the current condition or use of the area. *"
                            }
                            error={errors.currentCondition}
                            wide
                          >
                            <textarea
                              value={form.currentCondition}
                              onChange={(e) => put("currentCondition", e.target.value)}
                              placeholder={
                                form.niyogan === "no"
                                  ? "Briefly describe how the area is currently being used and its present condition."
                                  : "Describe what you know or observe about the area to help MENRO verify the planting location."
                              }
                            />
                          </Field>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
              <Title>Preferred Release Method</Title>
              <Field
                label="Preferred Release Method *"
                error={errors.releaseMethod}
              >
                <Radios
                  name="releaseMethod"
                  value={form.releaseMethod}
                  set={(v) => put("releaseMethod", v)}
                  items={[
                    ["Pick-up", "Pick-up"],
                    ["MENRO Delivery", "MENRO Delivery"],
                  ]}
                />
              </Field>
              <Title>
                {group ? "Proposed Planting Event" : "Planting Schedule"}
              </Title>
              <div className="sr-form-grid">
                {group && (
                  <Field label="Event Name *" error={errors.eventName}>
                    <input
                      value={form.eventName}
                      onChange={(e) => put("eventName", e.target.value)}
                    />
                  </Field>
                )}
                <Field
                  label={
                    group ? "Proposed Event Date *" : "Planned Planting Date *"
                  }
                  error={errors.activityDate}
                >
                  <input
                    type="date"
                    value={form.activityDate}
                    onChange={(e) => put("activityDate", e.target.value)}
                  />
                </Field>
                <Field
                  label={group ? "Start Time *" : "Planned Start Time"}
                  error={errors.startTime}
                >
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => put("startTime", e.target.value)}
                  />
                </Field>
                {group && (
                  <Field label="End Time *" error={errors.endTime}>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => put("endTime", e.target.value)}
                    />
                  </Field>
                )}
                <Field
                  label={
                    group
                      ? "Expected Participants *"
                      : "Planned Number of Planters"
                  }
                  error={errors.participants}
                >
                  <input
                    type="number"
                    min="1"
                    value={form.participants}
                    onChange={(e) => put("participants", e.target.value)}
                  />
                </Field>
                <Field label="Planting Site">
                  <input
                    value={
                      form.siteMode === "existing"
                        ? chosenSite?.siteName || chosenSite?.name || ""
                        : form.siteName
                    }
                    readOnly
                  />
                </Field>
              </div>
              <Title>Event / Schedule Location Preview</Title>
              <LocationMap
                barangay={form.siteBarangay}
                site={
                  form.siteMode === "existing"
                    ? chosenSite
                    : { latitude: form.latitude, longitude: form.longitude }
                }
              />
              <Title>Planting Care Information</Title>
              <div className="sr-form-grid">
                <Field
                  label="Who will be responsible for caring for the planted saplings? *"
                  error={errors.caretaker}
                >
                  <input
                    value={form.caretaker}
                    onChange={(e) => put("caretaker", e.target.value)}
                    placeholder="Enter the person, group, or organization responsible"
                  />
                </Field>
                <Field
                  label="How often do you plan to check the planted saplings? *"
                  error={errors.monitoringFrequency}
                >
                  <select
                    value={form.monitoringFrequency}
                    onChange={(e) => put("monitoringFrequency", e.target.value)}
                  >
                    <option value="">Select monitoring frequency</option>
                    {[
                      "Daily",
                      "Several times a week",
                      "Weekly",
                      "Every two weeks",
                      "Monthly",
                      "Other",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                {form.monitoringFrequency === "Other" && (
                  <Field
                    label="Please Specify *"
                    error={errors.monitoringOther}
                  >
                    <input
                      value={form.monitoringOther}
                      onChange={(e) => put("monitoringOther", e.target.value)}
                      placeholder="Specify how often the saplings will be checked"
                    />
                  </Field>
                )}
                <Field
                  label="How will you care for and maintain the saplings after planting? *"
                  error={errors.carePlan}
                  wide
                >
                  <textarea
                    value={form.carePlan}
                    onChange={(e) => put("carePlan", e.target.value)}
                    placeholder="Describe how the saplings will be watered, protected, checked, and maintained after planting."
                  />
                </Field>
              </div>
            </>
          )}
          {step === 4 && (
            <>
              {group && (
                <>
                  <Title>Supporting Document</Title>
                  <RequestLetterUpload
                    file={form.requestLetter}
                    error={errors.requestLetter}
                    onSelect={handleRequestLetter}
                    onRemove={() => put("requestLetter", null)}
                  />
                </>
              )}
              {!editing && (
                <>
                  <Title>Identification Information</Title>
                  <div className="sr-form-grid">
                    <Field
                      label="Identification Type *"
                      error={errors.identificationType}
                    >
                      <select
                        value={form.identificationType}
                        onChange={(e) =>
                          put("identificationType", e.target.value)
                        }
                      >
                        <option value="">Select identification type</option>
                        {IDENTIFICATION_DOCUMENTS.map((x) => (
                          <option key={x.value} value={x.value}>
                            {x.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="ID Number *" error={errors.idNumber}>
                      <input
                        value={form.idNumber}
                        onChange={(e) => put("idNumber", e.target.value)}
                      />
                    </Field>
                    {form.identificationType === "school_id" && (
                      <Field
                        label="School / Institution Name *"
                        error={errors.schoolInstitutionName}
                      >
                        <input
                          value={form.schoolInstitutionName}
                          onChange={(e) =>
                            put("schoolInstitutionName", e.target.value)
                          }
                        />
                      </Field>
                    )}
                  </div>
                </>
              )}
              <Title>Review Your Request</Title>
              <div className="sr-wizard-review">
                <p>
                  <strong>Requester:</strong> {form.fullName} · {form.sector}
                </p>
                <p>
                  <strong>Address:</strong> {form.street},{" "}
                  {form.addressBarangay}, Bulan, Sorsogon
                </p>
                <p>
                  <strong>Purpose:</strong>{" "}
                  {form.purpose === "Other" ? form.purposeOther : form.purpose}
                </p>
                <p>
                  <strong>Saplings:</strong>{" "}
                  {form.trees
                    .map(
                      (t) =>
                        `${inventory.find((x) => x.id === t.inventoryId)?.species || "Sapling"} — ${t.quantity}`,
                    )
                    .join(", ")}
                </p>
                <p>
                  <strong>Planting Site:</strong>{" "}
                  {form.siteMode === "existing"
                    ? chosenSite?.siteName || chosenSite?.name
                    : `${form.siteName} (Proposed Site)`}
                </p>
                <p>
                  <strong>Release:</strong> {form.releaseMethod} ·{" "}
                  {form.preferredReleaseDate}
                </p>
              </div>
              <div className="participant-confirmation-row">
                <label className="participant-confirmation">
                  <input
                    type="checkbox"
                    checked={form.confirmed}
                    onChange={(e) => put("confirmed", e.target.checked)}
                  />
                  <span>I confirm that the information provided is correct.</span>
                </label>
                {errors.confirmed && (
                  <small className="sr-field-error">{errors.confirmed}</small>
                )}
              </div>
            </>
          )}
          <div className="sr-wizard-actions">
            {step > 1 && (
              <button
                type="button"
                className="sr-secondary-btn sr-wizard-nav-btn"
                onClick={() => setStep(step - 1)}
              >
                <ArrowLeft aria-hidden="true" /> Back
              </button>
            )}
            {step < 4 ? (
              <button
                type="button"
                className="sr-primary-btn sr-wizard-nav-btn"
                onClick={next}
              >
                Next <ArrowRight aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                className="sr-primary-btn sr-wizard-nav-btn"
                disabled={submitting}
                onClick={submit}
              >
                {submitting
                  ? "Submitting..."
                  : editing
                    ? "Resubmit Request"
                    : "Submit Request"}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
function SelectBarangay({ value, set }) {
  return (
    <select value={value} onChange={(e) => set(e.target.value)}>
      <option value="">Select barangay</option>
      {BULAN_BARANGAYS.map((x) => (
        <option key={x}>{x}</option>
      ))}
    </select>
  );
}
function ProposedCoverageSummary({ form, status }) {
  const hectares = hectaresFromForm(form);
  const messages = {
    valid: ["Location Valid", "valid"],
    outside: ["Location Outside Selected Barangay", "invalid"],
    crosses: ["Proposed Planting Area Exceeds Barangay Boundary", "invalid"],
    pending: ["Select a location to validate coverage", "pending"],
  };
  const [label, tone] = messages[status] || messages.pending;
  return (
    <section className={`sr-coverage-summary ${tone}`} aria-live="polite">
      <h4>Proposed Planting Location</h4>
      <dl>
        <div><dt>Barangay</dt><dd>{form.siteBarangay || "—"}</dd></div>
        <div><dt>Planting Area</dt><dd>{hectares > 0 ? `${hectares.toFixed(2)} ha` : "—"}</dd></div>
        <div><dt>Coordinates</dt><dd>{form.latitude && form.longitude ? `${form.latitude}, ${form.longitude}` : "—"}</dd></div>
        <div><dt>Proposed Planting Coverage</dt><dd>{hectares > 0 ? `${hectares.toFixed(2)} ha` : "—"}</dd></div>
        <div><dt>Status</dt><dd>{label}</dd></div>
      </dl>
      {status === "outside" && <p>The selected location is outside {form.siteBarangay || "the selected barangay"}. Please select a location within the selected barangay boundary.</p>}
      {status === "crosses" && <p>The selected planting area extends beyond the boundary of {form.siteBarangay || "the selected barangay"}. Please move the planting location farther inside the barangay or select a smaller planting area.</p>}
      <small>Coverage is an estimated planning representation for MENRO review, not an official surveyed boundary.</small>
    </section>
  );
}

function LocationMap({ barangay, site, editable = false, areaHectares = 0, onPick, onValidationChange }) {
  const node = useRef(null),
    map = useRef(null),
    marker = useRef(null),
    coverage = useRef(null),
    boundaries = useRef(null),
    selectedFeature = useRef(null),
    siteRef = useRef(site);
  const [boundaryRevision, setBoundaryRevision] = useState(0);
  const selectedBarangay = String(barangay || site?.barangay || "").trim().toLowerCase();
  useEffect(() => {
    siteRef.current = site;
  }, [site]);
  useEffect(() => {
    if (!node.current || map.current) return;
    const instance = L.map(node.current, {
      center: BULAN_CENTER,
      zoom: 12,
      minZoom: 10,
      maxZoom: 19,
      zoomControl: true,
      attributionControl: true,
    });
    const key = import.meta.env.VITE_MAPTILER_API_KEY;
    if (key)
      L.tileLayer(
        `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${key}`,
        {
          tileSize: 512,
          zoomOffset: -1,
          maxZoom: 20,
          crossOrigin: true,
          attribution:
            '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        },
      ).addTo(instance);
    else
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(instance);
    map.current = instance;
    setTimeout(() => instance.invalidateSize(), 0);
    return () => {
      instance.remove();
      map.current = null;
      marker.current = null;
      coverage.current = null;
      boundaries.current = null;
      selectedFeature.current = null;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function draw() {
      const instance = map.current;
      if (!instance) return;
      try {
        const response = await fetch(BARANGAY_GEOJSON_URL);
        if (!response.ok) throw new Error("Boundary data unavailable");
        const data = await response.json();
        if (cancelled || !map.current) return;
        if (boundaries.current) instance.removeLayer(boundaries.current);
        let selectedBounds = null;
        const selected = selectedBarangay;
        selectedFeature.current = null;
        boundaries.current = L.geoJSON(data, {
          interactive: false,
          style: (feature) => {
            const name = String(
              feature?.properties?.ADM4_EN ||
                feature?.properties?.brgy_name ||
                feature?.properties?.barangay ||
                feature?.properties?.name ||
                "",
            )
              .trim()
              .toLowerCase();
            const active = selected && name === selected;
            return {
              color: active ? "#087443" : "#48725c",
              weight: active ? 3 : 1.4,
              opacity: 1,
              fillColor: active ? "#76c893" : "#dff2e5",
              fillOpacity: active ? 0.32 : 0.12,
            };
          },
          onEachFeature: (feature, layer) => {
            const name = String(
              feature?.properties?.ADM4_EN ||
                feature?.properties?.brgy_name ||
                feature?.properties?.barangay ||
                feature?.properties?.name ||
                "",
            ).trim();
            if (name)
              layer.bindTooltip(name, {
                permanent: true,
                direction: "center",
                className:
                  "participant-barangay-label participant-barangay-label-plain",
                interactive: false,
                opacity: 1,
              });
            if (
              selected &&
              name.toLowerCase() === selected &&
              layer.getBounds
            ) {
              selectedFeature.current = feature;
              const value = layer.getBounds();
              if (value.isValid())
                selectedBounds = selectedBounds
                  ? selectedBounds.extend(value)
                  : L.latLngBounds(value);
            }
          },
        }).addTo(instance);
        setBoundaryRevision((value) => value + 1);
        const currentSite = siteRef.current;
        const hasCoordinates =
          currentSite?.latitude !== "" &&
          currentSite?.latitude != null &&
          currentSite?.longitude !== "" &&
          currentSite?.longitude != null;
        const lat = Number(currentSite?.latitude),
          lng = Number(currentSite?.longitude);
        if (!(hasCoordinates && Number.isFinite(lat) && Number.isFinite(lng))) {
          const all = boundaries.current.getBounds();
          if (selectedBounds?.isValid())
            instance.fitBounds(selectedBounds, {
              padding: [28, 28],
              maxZoom: 14,
              animate: false,
            });
          else if (all.isValid())
            instance.fitBounds(all.pad(0.05), {
              padding: [18, 18],
              maxZoom: 12,
              animate: false,
            });
          else instance.setView(BULAN_CENTER, 12);
        }
      } catch {
        if (!cancelled) instance.setView(BULAN_CENTER, 12);
      }
      setTimeout(() => instance.invalidateSize(), 0);
    }
    draw();
    return () => {
      cancelled = true;
    };
  }, [selectedBarangay]);
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const hasCoordinates =
      site?.latitude !== "" &&
      site?.latitude != null &&
      site?.longitude !== "" &&
      site?.longitude != null;
    const lat = Number(site?.latitude),
      lng = Number(site?.longitude);
    if (marker.current) {
      marker.current.remove();
      marker.current = null;
    }
    if (coverage.current) {
      coverage.current.remove();
      coverage.current = null;
    }
    if (hasCoordinates && Number.isFinite(lat) && Number.isFinite(lng)) {
      const status = editable
        ? validateCoverage(selectedFeature.current, lat, lng, Number(areaHectares))
        : "valid";
      onValidationChange?.(status);
      if (editable && status !== "outside" && Number(areaHectares) > 0) {
        coverage.current = L.circle([lat, lng], {
          radius: Math.sqrt(Number(areaHectares) * 10000 / Math.PI),
          color: status === "valid" ? "#087443" : "#b45309",
          weight: 2,
          dashArray: "7 5",
          fillColor: status === "valid" ? "#29a866" : "#f59e0b",
          fillOpacity: 0.18,
          interactive: false,
        }).addTo(instance);
        coverage.current.bindTooltip("Proposed Planting Coverage", { sticky: true });
      }
      marker.current = L.marker([lat, lng], {
        draggable: editable,
        icon: L.divIcon({
          className: "sr-proposed-location-marker",
          html: `<span class="${status === "outside" ? "invalid" : ""}"></span>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
      }).addTo(instance);
      if (editable) marker.current.on("dragend", (event) => {
        const point = event.target.getLatLng();
        onPick?.(point.lat, point.lng);
      });
      instance.setView([lat, lng], 16, { animate: false });
    } else if (editable) onValidationChange?.("pending");
    setTimeout(() => instance.invalidateSize(), 0);
  }, [site?.latitude, site?.longitude, editable, areaHectares, boundaryRevision, onPick, onValidationChange]);
  useEffect(() => {
    const instance = map.current;
    if (!instance || !editable) return;
    const click = (event) => onPick?.(event.latlng.lat, event.latlng.lng);
    instance.on("click", click);
    return () => instance.off("click", click);
  }, [editable, onPick]);
  return (
    <div
      id={editable ? "proposed-planting-map" : undefined}
      ref={node}
      className="sr-wizard-map"
      aria-label={
        editable
          ? "Select planting location on Bulan map"
          : "Bulan planting location preview"
      }
    />
  );
}
