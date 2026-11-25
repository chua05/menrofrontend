import { test,expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
// Real E1 first-visit acceptance (Plan v2 E1). Runs from playwright.sample-monitoring-real.config.js only when
// MENRO_BROWSER_FIXTURE_MODE=first-visit: the backend browser server then seeds an eligible verified report and
// cohort with no visit, no sampling plan and no baseline (fixture JSON: mode, cohortId, plantingReportId,
// reportNumber, expectedSampleTarget, visitId = expected id of visit 1, visitDate = today in Manila).
// The same globalTeardown runs the private-evidence audit and fixture cleanup, keyed on fixture.visitId.
const frontend="http://127.0.0.1:5186",backend="http://127.0.0.1:5185";
const allowed=new Set([frontend,backend,"http://127.0.0.1:9399","http://127.0.0.1:8381","http://127.0.0.1:9398"]);
const root=process.env.MENRO_MONITORING_ACCEPTANCE_ROOT;
const fixture=async()=>JSON.parse(await readFile(path.join(root,"menro-phase3c-browser-fixture.json"),"utf8"));
const shot=(page,name)=>page.screenshot({path:path.join(root,`first-visit-${name}.png`),fullPage:true});
let unexpected=[],errors=[],traffic=[];
test.beforeEach(()=>{unexpected=[];errors=[];traffic=[];});
test.afterEach(async({page},info)=>{const route=new URL(page.url()).pathname;await info.attach("sanitized-diagnostics",{body:JSON.stringify({route,unexpectedOrigins:unexpected,pageErrors:errors,traffic}),contentType:"application/json"});expect(unexpected).toEqual([]);expect(errors).toEqual([]);});
async function isolate(page){
 await page.context().grantPermissions(["camera","geolocation"],{origin:frontend});
 page.on("pageerror",error=>errors.push(error.message));
 page.on("response",response=>{const u=new URL(response.url());if(allowed.has(u.origin))traffic.push({method:response.request().method(),path:u.pathname,status:response.status()});});
 page.on("requestfailed",request=>{const u=new URL(request.url());if(allowed.has(u.origin))traffic.push({method:request.method(),path:u.pathname,failed:true});});
 await page.route("**/*",route=>{const origin=new URL(route.request().url()).origin;if(allowed.has(origin))return route.continue();if(/^https:\/\/[abc]\.tile\.openstreetmap\.org$/.test(origin))return route.abort();unexpected.push(origin);return route.abort();});
}
const urlFor=role=>`/${role==="otherStaff"?"staff":role}/permanent-sample-monitoring`;
async function login(page,role){
 // Cold Vite start: the static "Loading MENRO" placeholder can stay up well past 20 s on the first navigation.
 const f=await fixture();await page.goto(urlFor(role),{waitUntil:"domcontentloaded"});await expect(page.locator("#login-email")).toBeVisible({timeout:60000});
 await page.locator("#login-email").fill(f.emails[role]);await page.locator("#login-password").fill(f.password);await page.locator("button.login-primary-btn").click();
 await expect(page).toHaveURL(new RegExp(`/${role==="otherStaff"?"staff":role}/dashboard$`),{timeout:30000});return f;
}
const backendGet=(page,pathname)=>page.waitForResponse(r=>{const u=new URL(r.url());return r.request().method()==="GET"&&u.origin===backend&&u.pathname===`/api${pathname}`;},{timeout:60000});
const collection=page=>backendGet(page,"/verified-sample-monitoring/visits");
async function survivalMonitoring(page){
 await page.getByRole("button",{name:"Open sidebar",exact:true}).click();
 await page.getByRole("link",{name:"Survival Monitoring",exact:true}).click();
 // "Loading survival monitoring..." holds the heading until three list requests resolve (slow on a cold emulator).
 await expect(page.getByRole("heading",{name:"Survival Monitoring",exact:true})).toBeVisible({timeout:60000});
}
async function monitorPlantedTrees(page){
 const [response]=await Promise.all([collection(page),page.locator(".sm-header-actions").getByRole("button",{name:"Monitor Planted Trees",exact:true}).click()]);
 await expect(page.getByRole("dialog",{name:"Monitor Planted Trees"})).toBeVisible();return response;
}
async function openAdmin(page){
 const f=await login(page,"admin");const list=collection(page);await survivalMonitoring(page);const r=await list;expect(r.status()).toBe(200);
 expect((await r.json()).data.visits.some(v=>v.id===f.visitId)).toBe(true);
 await page.locator(`tr[data-sample-visit-row="${f.visitId}"]`).getByRole("button",{name:`View monitoring visit ${f.visitId}`,exact:true}).click();
 const dialog=page.getByRole("dialog",{name:"Review Monitoring Visit"});await expect(dialog).toBeVisible();await expect(dialog.getByRole("combobox",{name:"Verified Planting Report *",exact:true})).toHaveValue(f.visitId);return dialog;
}
async function api(page,endpoint,method="GET",body){return page.evaluate(async({endpoint,method,body})=>{const {authenticatedFetch}=await import("/src/services/authenticatedApi.js");const r=await authenticatedFetch(endpoint,{method,...(body?{body:JSON.stringify(body),headers:{"Content-Type":"application/json"}}:{})});return{status:r.status,body:await r.json()};},{endpoint,method,body});}
const detail=(page,id)=>api(page,`/verified-sample-monitoring/visits/${id}`);
const selectTree=async(page,id)=>{const button=page.locator(".psm-tree-list button").filter({hasText:id});if(await button.getAttribute("aria-expanded")!=="true")await button.click();};
const active=page=>page.locator(".psm-tree");
const waitPut=(page,id)=>page.waitForResponse(r=>r.request().method()==="PUT"&&new URL(r.url()).pathname===`/api/verified-sample-monitoring/visits/${id}`);
async function saveTree(page,f){const response=waitPut(page,f.visitId);await page.getByRole("button",{name:"Save Tree Assessment",exact:true}).click();const r=await response;expect(r.status()).toBe(200);return(await r.json()).data;}
async function submit(page,f){const response=waitPut(page,f.visitId);await page.getByRole("button",{name:"Submit Monitoring Visit",exact:true}).click();const r=await response;expect(r.status()).toBe(200);const v=(await r.json()).data;expect(v.status).toBe("PENDING_ADMIN_APPROVAL");await expect(page.getByText(/Pending Admin Review · Revision/)).toBeVisible();return v;}
async function capture(page,tree,time,latitude){
 await selectTree(page,tree);await page.context().setGeolocation({latitude,longitude:123.932983,accuracy:5});
 const created=page.waitForResponse(r=>r.request().method()==="POST"&&new URL(r.url()).pathname==="/api/evidence-capture-sessions");
 await page.getByRole("button",{name:`Capture verified photo for ${tree}`}).click();await page.getByRole("button",{name:/Continue to Camera/}).click();
 const video=page.locator("video.secure-camera-preview");await expect.poll(()=>video.evaluate(v=>v.srcObject instanceof MediaStream&&v.videoWidth>0&&v.videoHeight>0&&v.srcObject.getVideoTracks().some(t=>t.readyState==="live")),{timeout:15000}).toBe(true);
 await expect.poll(()=>video.evaluate(v=>v.currentTime),{timeout:15000}).toBeGreaterThan(time);
 const sessionResponse=await created;expect(sessionResponse.status()).toBe(201);expect(sessionResponse.request().postDataJSON().sampleId).toBe(tree);const session=(await sessionResponse.json()).data;
 await page.getByRole("button",{name:"Capture",exact:true}).click();const verification=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/evidence-capture-sessions/${session.captureSessionId}/verify`);
 await page.getByRole("button",{name:/Verify & Use Photo/}).click();const verifiedResponse=await verification;expect(verifiedResponse.status()).toBe(200);expect((await verifiedResponse.json()).data.location.latitude).toBe(latitude);
 await expect(page.getByAltText(`Verified evidence preview for ${tree}`)).toBeVisible();
 // A verified capture that is not uploaded yet is pending upload (D-8), never "Verifying".
 await expect(active(page).locator(".pr-location-status")).toHaveText("Pending Upload");
}
async function verifyLocation(page,tree,f){
 await selectTree(page,tree);const wait=page.waitForResponse(r=>r.request().method()==="PUT"&&new URL(r.url()).pathname===`/api/verified-sample-monitoring/visits/${f.visitId}/samples/${tree}/evidence`);
 await page.getByRole("button",{name:`Upload verified photo for ${tree}`}).click();expect((await wait).status()).toBe(200);
 await expect(page.getByAltText(`Verified evidence preview for ${tree}`)).toHaveCount(0);await expect(active(page).locator(".pr-location-status")).toHaveText("Verified");
}
const exactText=label=>new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}$`);
const shellValue=(dialog,label)=>dialog.locator(".psm-shell dt").filter({hasText:exactText(label)}).locator("xpath=following-sibling::dd");
const plusOneMonth=value=>{const [y,m,d]=value.split("-").map(Number);const absolute=y*12+m;const year=Math.floor(absolute/12),month=absolute%12;const last=new Date(Date.UTC(year,month+1,0,12)).getUTCDate();return `${year}-${String(month+1).padStart(2,"0")}-${String(Math.min(d,last)).padStart(2,"0")}`;};

test("real first visit: eligible report, 10% sample registration, evidence, draft, submit, return, approval, lock and visit 2 schedule",async({browser})=>{
 test.setTimeout(600000);
 const staffContext=await browser.newContext();const staff=await staffContext.newPage();await isolate(staff);
 let f,ids;
 await test.step("1. Staff sees the eligible report's Section 1 context and 10% target, then starts visit 1 on the fixture date",async()=>{
  f=await login(staff,"staff");expect(["first-visit","verified-report"]).toContain(f.mode);const fromReport=f.mode==="verified-report";expect(f.sampleIds).toEqual([]);expect(f.expectedSampleTarget).toBe(3);
  ids=[1,2,3].map(n=>`${f.reportNumber}-T00${n}`);
  await survivalMonitoring(staff);const readinessResponse=backendGet(staff,`/verified-sample-monitoring/${fromReport?"verified-reports":"readiness"}`);
  const listed=await monitorPlantedTrees(staff);expect((await listed.json()).data.visits).toEqual([]);
  const readiness=(await(await readinessResponse).json()).data;const row=readiness.eligible.find(entry=>entry.cohortId===f.cohortId);
  expect(row.canCreateVisit).toBe(true);expect(row.context.sampleTarget).toBe(3);expect(row.nextScheduledDueDate).toBe(f.visitDate);
  const dialog=staff.getByRole("dialog",{name:"Monitor Planted Trees"});
  await dialog.getByRole("combobox",{name:"Verified Planting Report *",exact:true}).selectOption(`ready:${f.cohortId}`);
  const expected={"Planting Report ID":f.reportNumber,"Planting Date":f.visitDate,"Verification Status":"Approved","Verified Planted Quantity":"25",
   "Species and Quantities":fromReport?/^Narra/:"Narra: 25 planted","Automatic 10% Sample Target":"3","Sample Registration Status":"Not Started","Registered Sample Tree Count":"0",
   "Monitoring Visit Number":"1","Current Monitoring Status":"First Visit Available"};
  for(const [label,value] of Object.entries(expected))await expect(shellValue(dialog,label)).toHaveText(value);
  for(const label of ["Planting Site Name","Barangay / Address"])await expect(shellValue(dialog,label)).toHaveCount(1);
  await expect(dialog.getByText("No permanent-sample cohort",{exact:false})).toHaveCount(0);
  await expect(dialog).not.toContainText(/spot-check|sampling plan|not eligible|turned off/i);await expect(dialog.getByText("No authorized monitoring visits are available.")).toHaveCount(0);
  await expect(dialog.locator(".psm-shell .leaflet-container")).toBeVisible();await expect(dialog.locator(".psm-shell").getByLabel("Stem Diameter (mm)")).toBeDisabled();
  await expect(dialog.getByRole("button",{name:"Submit Monitoring Visit",exact:true})).toBeDisabled();
  await shot(staff,"1-eligible-shell");
  const created=staff.waitForResponse(r=>r.request().method()==="POST"&&new URL(r.url()).pathname===(fromReport?`/api/verified-sample-monitoring/verified-reports/${f.plantingReportId}/first-visit`:`/api/verified-sample-monitoring/cohorts/${f.cohortId}/visits`));
  await dialog.locator('section[aria-labelledby="psm-readiness-selection-title"]').getByRole("button",{name:"Start Visit 1",exact:true}).click();
  const response=await created;expect(response.status()).toBe(201);expect(response.request().postDataJSON()).toEqual({visitDate:f.visitDate});
  const visit=(await response.json()).data;expect(visit.id).toBe(f.visitId);expect(visit.sampleAssessments.map(row=>row.sampleId)).toEqual(ids);
  await expect(dialog.getByRole("combobox",{name:"Verified Planting Report *",exact:true})).toHaveValue(f.visitId);
  await expect(dialog.locator(".psm-tree-list button")).toHaveCount(3);for(const id of ids)await expect(dialog.locator(".psm-tree-list").getByText(id,{exact:true})).toBeVisible();
 });
 await test.step("2. Each tree: Take Photo, Verify Photo Location, then condition and measurements; markers open their tree",async()=>{
  const plan=[{condition:"Healthy",height:"120",diameter:"60",remarks:"Vigorous new leaves"},{condition:"Damaged",height:"90",diameter:"40",remarks:"Browsing damage on two leaves"},{condition:"Dead",cause:"Drought",remarks:"Dry brittle stem, no green tissue"}];
  for(const [index,id] of ids.entries()){
   await capture(staff,id,0.3+index*0.7,Number((12.662311+index*0.00003).toFixed(6)));await verifyLocation(staff,id,f);
   const entry=plan[index];await active(staff).getByRole("radio",{name:entry.condition,exact:true}).check();
   if(entry.cause){await active(staff).getByLabel("Cause of Mortality *").selectOption(entry.cause);await active(staff).getByLabel("Individual Remarks *").fill(entry.remarks);}
   else{await active(staff).getByLabel("Height (cm)").fill(entry.height);await active(staff).getByLabel("Stem Diameter (mm)").fill(entry.diameter);await active(staff).getByLabel("Individual Remarks").fill(entry.remarks);}
   const saved=await saveTree(staff,f);expect(saved.sampleAssessments[index].condition).toBe(entry.condition);
   await expect(staff.locator(".psm-tree-list button").filter({hasText:id})).toContainText(`${entry.condition} · Saved`);
  }
  await expect(active(staff).locator(".psm-tree-marker")).toHaveCount(3);await expect(active(staff)).toContainText(ids[2]);
  await active(staff).locator(`.psm-tree-marker[title="Open ${ids[0]} assessment"]`).dispatchEvent("click");await expect(active(staff).locator("legend")).toHaveText(ids[0]);
  await shot(staff,"2-tree-markers");
 });
 await test.step("3. Save Draft, reload, and the draft persists; the second Staff user cannot read or edit it",async()=>{
  await staff.getByLabel("Overall Visit Remarks (Optional)").fill("First-visit baseline field check");
  const put=waitPut(staff,f.visitId);await staff.getByRole("button",{name:"Save Draft",exact:true}).click();expect((await put).status()).toBe(200);
  await expect(staff.getByRole("status").filter({hasText:"Monitoring visit draft saved and confirmed by MENRO."})).toBeVisible();
  await staff.reload({waitUntil:"domcontentloaded"});await expect(staff.getByRole("heading",{name:"Survival Monitoring",exact:true})).toBeVisible({timeout:60000});
  await monitorPlantedTrees(staff);const dialog=staff.getByRole("dialog",{name:"Monitor Planted Trees"});await expect(dialog.getByRole("combobox",{name:"Verified Planting Report *",exact:true})).toHaveValue(f.visitId);
  for(const [index,condition] of ["Healthy","Damaged","Dead"].entries())await expect(dialog.locator(".psm-tree-list button").filter({hasText:ids[index]})).toContainText(`${condition} · Saved`);
  await expect(dialog.getByLabel("Overall Visit Remarks (Optional)")).toHaveValue("First-visit baseline field check");
  const stored=(await detail(staff,f.visitId)).body.data;expect(stored.status).toBe("DRAFT");expect(stored.sampleAssessments.map(row=>row.condition)).toEqual(["Healthy","Damaged","Dead"]);
  expect(stored.sampleAssessments[2]).toMatchObject({mortalityCause:"Drought"});expect(stored.sampleAssessments.map(row=>row.evidenceHistory.length)).toEqual([1,1,1]);
  const otherContext=await browser.newContext();const other=await otherContext.newPage();await isolate(other);await login(other,"otherStaff");
  expect([403,404]).toContain((await detail(other,f.visitId)).status);
  expect([403,404,409]).toContain((await api(other,`/verified-sample-monitoring/visits/${f.visitId}`,"PUT",{expectedVersion:stored.version,assessments:stored.sampleAssessments,submit:false})).status);
  await survivalMonitoring(other);const otherList=await monitorPlantedTrees(other);expect((await otherList.json()).data.visits.map(v=>v.id)).not.toContain(f.visitId);await otherContext.close();
  expect((await detail(staff,f.visitId)).body.data.version).toBe(stored.version);
 });
 await test.step("4. Submit Monitoring Visit: Pending Admin Review, with no Staff approval controls",async()=>{
  await submit(staff,f);
  for(const name of ["Approve Visit","Return for Correction"])await expect(staff.getByRole("button",{name,exact:true})).toHaveCount(0);
  await expect(staff.getByRole("group",{name:"Admin visit decision"})).toHaveCount(0);
 });
 const adminContext=await browser.newContext();const admin=await adminContext.newPage();await isolate(admin);
 await test.step("5. Admin returns with a reason, Staff corrects and resubmits, Admin approves",async()=>{
  const review=await openAdmin(admin);await expect(review.locator("footer.psm-footer").getByRole("group",{name:"Admin visit decision"})).toBeVisible();
  await admin.getByLabel("Return reason").fill(`Recheck ${ids[1]} measurements.`);
  const returned=admin.waitForResponse(r=>new URL(r.url()).pathname.endsWith(`/${f.visitId}/review`)&&r.request().method()==="POST");await admin.getByRole("button",{name:"Return for Correction",exact:true}).click();
  expect((await(await returned).json()).data.status).toBe("RETURNED");
  await staff.getByRole("button",{name:"Reload visit",exact:true}).click();await expect(staff.getByText(/Returned for Correction · Revision/)).toBeVisible();
  await selectTree(staff,ids[1]);await active(staff).getByLabel("Height (cm)").fill("92");await active(staff).getByLabel("Stem Diameter (mm)").fill("41");
  await saveTree(staff,f);await capture(staff,ids[1],2.4,12.662326);await verifyLocation(staff,ids[1],f);await submit(staff,f);
  await admin.getByRole("button",{name:"Reload visit",exact:true}).click();await expect(admin.getByText(/Pending Admin Review · Revision/)).toBeVisible();
  const approvedWait=admin.waitForResponse(r=>new URL(r.url()).pathname.endsWith(`/${f.visitId}/review`)&&r.request().method()==="POST");await admin.getByRole("button",{name:"Approve Visit",exact:true}).click();
  const approved=(await(await approvedWait).json()).data;expect(approved.status).toBe("APPROVED");expect(approved.visitDate).toBe(f.visitDate);expect(approved.sampleAssessments.map(row=>row.sampleId)).toEqual(ids);
  await expect(admin.getByText("Approved visits are read-only.")).toBeVisible();await shot(admin,"5-approved-visit");
 });
 await test.step("6. Sample locked with unchanged Tree IDs, history shows visit 1 Approved and visit 2 one month later, not yet available",async()=>{
  await staff.getByRole("button",{name:"Reload visit",exact:true}).click();await expect(staff.getByText("Approved visits are read-only.")).toBeVisible();
  await expect(staff.getByRole("button",{name:/Save Draft|Save Tree Assessment|Submit Monitoring Visit|Capture verified photo/})).toHaveCount(0);
  const visit=(await detail(staff,f.visitId)).body.data;expect(visit.sampleAssessments.map(row=>row.sampleId)).toEqual(ids);
  const next=plusOneMonth(visit.dateMonitored||f.visitDate);expect(visit.dateMonitored).toBe(f.visitDate);
  const table=staff.getByRole("table",{name:"Monitoring Visit History"});
  await expect(table.locator("tbody tr").filter({hasText:/^1/})).toContainText("Approved");
  const second=table.locator("tbody tr").filter({hasText:next});await expect(second).toContainText("Scheduled — Not yet available");await expect(second.locator("td").first()).toHaveText("2");
  await shot(staff,"6-history");
  const readiness=(await api(staff,"/verified-sample-monitoring/readiness")).body.data;const row=readiness.cohorts.find(entry=>entry.cohortId===f.cohortId);
  expect(row.nextVisitNumber).toBe(2);expect(row.nextScheduledDueDate).toBe(next);expect(row.canCreateVisit).toBe(false);
  expect(row.context).toMatchObject({sampleRegistrationStatus:"APPROVED",registeredSampleCount:3});
  // The cohorts page: first-visit cohorts never show the legacy separate Sampling Plan / Staff Baseline editors.
  await staff.goto("/staff/verified-planting-cohorts",{waitUntil:"domcontentloaded"});const select=staff.locator("#verified-cohort-selection");await expect(select).toBeVisible({timeout:60000});
  await select.selectOption(f.cohortId);await expect(staff.getByRole("heading",{name:"First-Visit Baseline Registration",exact:true})).toBeVisible();
  await expect(staff.getByRole("heading",{name:"Sampling Plan",exact:true})).toHaveCount(0);await expect(staff.getByRole("button",{name:/Submit baseline for approval|sampling plan/i})).toHaveCount(0);
  await expect(staff.getByText("Status: APPROVED",{exact:true})).toBeVisible();
  const reopened=(await detail(staff,f.visitId)).body.data;expect(reopened.sampleAssessments.map(row=>row.sampleId)).toEqual(ids);
 });
 await test.step("7. Roles: Staff has no Approve/Return; the second Staff user cannot edit Staff A's visit",async()=>{
  const write=await api(admin,`/verified-sample-monitoring/visits/${f.visitId}`,"PUT",{expectedVersion:1,assessments:[],submit:false});expect(write.status).toBe(403);
  const otherContext=await browser.newContext();const other=await otherContext.newPage();await isolate(other);await login(other,"otherStaff");
  expect([403,404,409]).toContain((await api(other,`/verified-sample-monitoring/visits/${f.visitId}`,"PUT",{expectedVersion:1,assessments:[],submit:false})).status);
  expect([403,404]).toContain((await detail(other,f.visitId)).status);await otherContext.close();
 });
 await adminContext.close();await staffContext.close();
});
