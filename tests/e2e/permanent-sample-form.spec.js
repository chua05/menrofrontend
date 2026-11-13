import { Buffer } from "node:buffer";
import { test, expect } from "@playwright/test";
const origin="http://127.0.0.1:5184";
const route="/staff/permanent-sample-monitoring?role=staff";
const visitId="VPMV-FORM-FIXTURE";
const json=(route,data,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify({success:status<400,...(status<400?{data}:{message:data})})});
function fixture() {
 return {id:visitId,cohortId:"cohort-form",siteId:"site-form",visitDate:"2026-11-01",status:"DRAFT",version:4,samplingPlanVersion:1,baselineVersion:1,
  sampleAssessments:[{sampleId:"TREE-A",condition:"Healthy",heightCentimeters:100,diameterCentimeters:5,remarks:"Previous observation",assessmentRevision:0,evidenceHistory:[]},{sampleId:"TREE-B",condition:"",remarks:"",assessmentRevision:0,evidenceHistory:[]}],
  visitContext:{reportNumber:"PR-2026-FIXTURE",siteName:"Bulan fixture site",barangay:"Fixture barangay",plantingDate:"2026-10-01",reportStatus:"Completed",verifiedPlantedQuantity:50,approvedSampleTarget:2,planStatus:"APPROVED",baselineStatus:"APPROVED",registeredSampleTrees:2,speciesQuantities:[{species:"Narra",verifiedPlantedQuantity:30},{species:"Molave",verifiedPlantedQuantity:null}],
   site:{siteName:"Bulan fixture site",latitude:12.662301,longitude:123.932983,coverageRadiusMeters:50},schedule:{startMonitoringDate:"2026-11-01",nextMonitoringDate:"2026-12-01",visitNumber:2,status:"Scheduled"},
   samples:["TREE-A","TREE-B"].map(sampleId=>({sampleId,species:"Narra",latitude:12.66231,longitude:123.93299,baseline:{heightCentimeters:70,diameterCentimeters:3,condition:"Healthy",date:"2026-10-01",remarks:"Baseline observed",photoCount:0}}))}}
}
async function setup(page,{error=0,timeout=false,returned=false,multiple=false,noSchedule=false}={}) {
 const state={visit:fixture(),puts:[],uploads:[],questions:[],external:[],unregistered:[],reads:[]}; if(noSchedule)state.visit.visitContext.schedule={startMonitoringDate:null,nextMonitoringDate:null,visitNumber:null,status:null}; if(returned){state.visit.status="RETURNED";state.visit.sampleAssessments[0].evidenceHistory=[{revision:0}];}
 await page.addInitScript(()=>{window.__PHASE3C_GATE_ENABLED__="true";});
 await page.route("**/*",async r=>{
  const u=new URL(r.request().url()),method=r.request().method();
  if(u.origin!==origin){state.external.push(u.origin);return r.abort();}
  if(!u.pathname.startsWith("/api/")) return r.continue();
  const path=u.pathname.slice(4); state.reads.push([method,path]);
  if(path==="/notifications")return json(r,[]);
  if(path==="/sites/barangay-boundaries")return json(r,{type:"FeatureCollection",features:[]});
  if(path==="/sample-monitoring-information"){
   if(method==="POST"){const body=r.request().postDataJSON();state.questions.push(body);return json(r,{id:"question-fixture",...body,status:"OPEN",history:[]});}
   return json(r,{requests:[],nextCursor:null});
  }
  if(path==="/verified-sample-monitoring/visits")return json(r,{visits:[{...state.visit,progress:{completed:1,total:2,rechecking:0}},...(multiple?[{...state.visit,id:visitId+"-SECOND",progress:{completed:1,total:2,rechecking:0}}]:[])],nextCursor:null});
  if(path===`/verified-sample-monitoring/visits/${visitId}`){
   if(method==="PUT"){
    const body=r.request().postDataJSON();state.puts.push(body);
    if(error)return json(r,`Confirmed fixture error ${error}`,error);
    state.visit={...state.visit,version:state.visit.version+1,status:body.submit?"PENDING_ADMIN_APPROVAL":"DRAFT",visitRemarks:body.visitRemarks,dateMonitored:body.dateMonitored,sampleAssessments:body.assessments.map(a=>({...a,assessmentRevision:returned?1:0,evidenceHistory:state.visit.sampleAssessments.find(x=>x.sampleId===a.sampleId).evidenceHistory}))};
    if(timeout)await new Promise(resolve=>setTimeout(resolve,150));
   }
   return json(r,state.visit);
  }
  if(path==="/evidence-capture-sessions")return json(r,{captureSessionId:"capture-fixture",nonce:"fixture-nonce"},201);
  if(path==="/evidence-capture-sessions/capture-fixture/verify")return json(r,{verificationId:"verification-fixture",imageSha256:"fixture-boundary-hash",location:{latitude:12.662301,longitude:123.932983,accuracyMeters:5}});
  if(/^\/verified-sample-monitoring\/visits\/[^/]+\/samples\/[^/]+\/evidence$/.test(path)){
   const sampleId=path.split("/")[5];state.uploads.push({path,key:r.request().headers()["idempotency-key"],body:r.request().postDataBuffer().toString()});
   if(state.uploads.length===1)return json(r,"Private upload temporarily unavailable.",503);
   state.visit.sampleAssessments.find(x=>x.sampleId===sampleId).evidenceHistory.push({revision:returned?1:0,location:{latitude:12.662301,longitude:123.932983,accuracyMeters:5}}); return json(r,{linked:true});
  }
  if(path.startsWith("/evidence/sample-monitoring/"))return r.fulfill({status:200,contentType:"image/png",body:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXz8AAAAASUVORK5CYII=","base64")});
  state.unregistered.push([method,path]); return json(r,"Unregistered test API request",500);
 });
 await page.goto(route); await page.getByRole("button",{name:visitId,exact:true}).click(); await expect(page.getByRole("dialog",{name:"Monitor Planted Trees"})).toBeVisible();
 return state;
}
const tree=async(page,id)=>{const button=page.locator(".psm-tree-list button").filter({hasText:id});if(await button.getAttribute("aria-expanded")!=="true")await button.click();};
const active=page=>page.locator(".psm-tree");
const modal=page=>page.getByRole("dialog",{name:"Monitor Planted Trees"});
test("authoritative context, baseline units, tree navigation and unfinished edits persist",async({page})=>{
 const s=await setup(page);
 await expect(page.locator(".psm-info").getByText("PR-2026-FIXTURE",{exact:true})).toBeVisible();await expect(page.getByRole("combobox",{name:"Verified Planting Report",exact:true}).locator("option:checked")).toHaveText(/^PR-2026-FIXTURE · Bulan fixture site · Visit 2026-11-01$/);await page.getByLabel("Date Monitored *").fill("2026-11-01");
 await expect(page.getByText("2026-12-01",{exact:true})).toBeVisible();await expect(page.locator(".psm-tree-list button")).toHaveCount(2);
 await active(page).getByLabel("Height (cm)").fill("125.5");await page.getByRole("button",{name:"Next Tree"}).click(); await active(page).getByRole("radio",{name:"Damaged",exact:true}).check();
 await page.getByRole("button",{name:"Previous Tree"}).click();await expect(active(page).getByLabel("Height (cm)")).toHaveValue("125.5");
 await expect(page.getByRole("button",{name:"Previous Tree"})).toBeDisabled();await expect(page.locator(".leaflet-container")).toBeVisible();
 expect(s.unregistered).toEqual([]);expect(s.puts).toHaveLength(0);
});
test("incomplete draft saves, close/reopen keeps it, final submission focuses the incomplete tree",async({page})=>{
 const s=await setup(page);await page.getByLabel("Overall Visit Remarks (Optional)").fill("Field observations");await page.getByRole("button",{name:"Save TREE-A Draft"}).click();
 await expect(page.getByText(/Draft · Revision 5/)).toBeVisible();expect(s.puts[0]).toMatchObject({expectedVersion:4,submit:false,visitRemarks:"Field observations"});
 await page.getByRole("button",{name:"Close monitoring visit"}).click();await page.getByRole("button",{name:visitId,exact:true}).click();await expect(page.getByLabel("Overall Visit Remarks (Optional)")).toHaveValue("Field observations");
 await page.getByRole("button",{name:"Submit Visit",exact:true}).click();await expect(active(page).getByRole("radio",{name:"Healthy",exact:true})).toBeFocused();await expect(active(page).getByRole("radiogroup",{name:"Tree Condition *"})).toHaveAttribute("aria-invalid","true");expect(s.puts).toHaveLength(1);
 await active(page).getByRole("radio",{name:"Damaged",exact:true}).check();await page.getByRole("button",{name:"Submit Visit",exact:true}).click();await expect(page.getByText(/Pending Admin Review · Revision 6/)).toBeVisible();expect(s.puts).toHaveLength(2);
});
test("rechecking remains separate, required search notes focus, tree clarification binds saved revision",async({page})=>{
 const s=await setup(page);await tree(page,"TREE-B");await active(page).getByRole("radio",{name:"Needs Rechecking",exact:true}).check();await page.getByRole("button",{name:"Save TREE-B Draft"}).click();
 await expect(active(page).getByLabel("Assessment Remarks *")).toBeFocused();await active(page).getByLabel("Assessment Remarks *").fill("Tag could not be confirmed");
 await active(page).getByLabel("Investigation outcome").selectOption("Not Located After Rechecking");await page.getByRole("button",{name:"Save TREE-B Draft"}).click();await expect(active(page).getByLabel("Search findings")).toBeFocused();
 await active(page).getByLabel("Search findings").fill("Searched registered coordinates and surrounding area");await page.getByRole("button",{name:"Save TREE-B Draft"}).click();await expect(page.getByText(/Draft · Revision 5/)).toBeVisible();
 await page.getByLabel("Request additional information from Requester").check();const panel=active(page).getByRole("region",{name:"Optional requester information"});await panel.getByLabel("Question to the verified planting requester").fill("Was the tree tag moved?");await panel.getByRole("button",{name:"Request Information",exact:true}).click();
 await expect(panel.getByText("Was the tree tag moved?")).toBeVisible();expect(s.questions).toEqual([{visitId,sampleId:"TREE-B",assessmentRevision:0,question:"Was the tree tag moved?"}]);await expect(page.getByText("Confirmed Dead",{exact:true})).toBeVisible();expect(s.unregistered).toEqual([]);
});
test("failed evidence retry keeps binding and key, retrieval is private, refresh preserves unsaved tree edits",async({page})=>{
 const s=await setup(page,{returned:true});await active(page).getByLabel("Height (cm)").fill("147");await page.getByRole("button",{name:"Capture verified photo for TREE-A"}).click();await page.getByRole("button",{name:"Verify fixture camera photo"}).click();
 await expect(page.getByAltText("Verified evidence preview for TREE-A")).toBeVisible();await expect.poll(()=>page.getByAltText("Verified evidence preview for TREE-A").evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);await expect(page.locator(".leaflet-container")).toBeVisible();await expect(page.getByText(/Accuracy: 5 m/)).toBeVisible();
 await page.getByRole("button",{name:"Upload verified photo for TREE-A"}).click();await expect(active(page).getByRole("alert")).toContainText("Private upload temporarily unavailable.");await expect(page.getByAltText("Verified evidence preview for TREE-A")).toBeVisible();
 await page.getByRole("button",{name:"Upload verified photo for TREE-A"}).click();await expect(page.getByAltText("Verified evidence preview for TREE-A")).toHaveCount(0);await expect(active(page).getByRole("alert")).toHaveCount(0);expect(s.uploads).toHaveLength(2);expect(s.uploads[1].key).toBe(s.uploads[0].key);expect(s.uploads[1].body).toContain('name="expectedVisitVersion"');expect(s.uploads[1].body).toContain("verification-fixture");
 await expect(active(page).getByLabel("Height (cm)")).toHaveValue("147");await expect(page.getByRole("button",{name:"View private evidence revision 0",exact:true})).toBeVisible();await page.getByRole("button",{name:"View private evidence revision 1",exact:true}).click();await expect(page.getByAltText("Private evidence for TREE-A, revision 1")).toBeVisible();
 await expect(modal(page).locator('img[src*="storage.googleapis"],img[src*="firebasestorage"]')).toHaveCount(0);expect(s.unregistered).toEqual([]);
});
for(const status of [400,401,403,409,422,500,503])test(`save ${status} ends busy state, retains edits, never retries automatically`,async({page})=>{
 const s=await setup(page,{error:status});await active(page).getByLabel("Height (cm)").fill("133");await page.getByRole("button",{name:"Save TREE-A Draft"}).click();await expect(modal(page).getByRole("alert")).toContainText(status===409?"This monitoring visit changed.":`Confirmed fixture error ${status}`);await expect(page.getByRole("button",{name:"Save TREE-A Draft"})).toBeEnabled();await expect(active(page).getByLabel("Height (cm)")).toHaveValue("133");expect(s.puts).toHaveLength(1);
});
for(const width of [320,360,390,430,768,1440])test(`form and interactive map fit ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:900});const s=await setup(page);await tree(page,"TREE-B");await active(page).getByRole("radio",{name:"Needs Rechecking",exact:true}).check();await page.locator(".psm-location").scrollIntoViewIfNeeded();
 await expect(page.locator(".leaflet-container")).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await modal(page).evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.screenshot({path:info.outputPath(`monitoring-form-${width}.png`),fullPage:true});await page.locator(".psm-body").evaluate(el=>{el.scrollTop=0;});await page.screenshot({path:info.outputPath(`monitoring-form-top-${width}.png`),fullPage:true});expect(s.unregistered).toEqual([]);
});

test("timed-out save requires authoritative reconciliation and does not repeat the write",async({page})=>{
 await page.addInitScript(()=>{const original=window.setTimeout;window.setTimeout=(fn,ms,...args)=>original(fn,ms===60000?30:ms,...args);});
 const s=await setup(page,{timeout:true});await page.getByRole("button",{name:"Save TREE-A Draft"}).click();await expect(page.getByRole("button",{name:"Check saved outcome"})).toBeVisible();await expect(page.getByRole("button",{name:"Save TREE-A Draft"})).toBeDisabled();
 await page.getByRole("button",{name:"Close monitoring visit"}).click();await page.getByRole("button",{name:visitId,exact:true}).click();await expect(page.getByRole("button",{name:"Check saved outcome"})).toBeVisible();
 await page.getByRole("button",{name:"Check saved outcome"}).click();await expect(page.getByRole("button",{name:"Check saved outcome"})).toHaveCount(0);await expect(page.getByRole("button",{name:"Save TREE-A Draft"})).toBeEnabled();expect(s.puts).toHaveLength(1);
});
test("actual assessment date rejects future input without modifying the schedule",async({page})=>{
 const s=await setup(page);await page.getByLabel("Date Monitored *").fill("2099-01-01");await page.getByRole("button",{name:"Save TREE-A Draft"}).click();await expect(page.getByLabel("Date Monitored *")).toBeFocused();expect(s.puts).toHaveLength(0);
 await page.getByLabel("Date Monitored *").fill("2026-11-01");await page.getByRole("button",{name:"Save TREE-A Draft"}).click();await expect(page.getByText(/Draft · Revision 5/)).toBeVisible();expect(s.puts[0].dateMonitored).toBe("2026-11-01");expect(s.visit.visitDate).toBe("2026-11-01");expect(s.visit.visitContext.schedule.nextMonitoringDate).toBe("2026-12-01");
});


test("Tree ID accordion collapses and reopens without losing unsaved assessments",async({page})=>{
 const s=await setup(page);await active(page).getByLabel("Height (cm)").fill("126");
 const first=page.locator(".psm-tree-list button").filter({hasText:"TREE-A"});
 await first.click();await expect(first).toHaveAttribute("aria-expanded","false");await expect(active(page)).toHaveCount(0);
 await first.click();await expect(first).toHaveAttribute("aria-expanded","true");await expect(active(page).getByLabel("Height (cm)")).toHaveValue("126");
 await page.getByRole("button",{name:"Next Tree"}).click();await active(page).getByRole("radio",{name:"Damaged",exact:true}).check();
 await page.getByRole("button",{name:"Previous Tree"}).click();await expect(active(page).getByLabel("Height (cm)")).toHaveValue("126");expect(s.puts).toHaveLength(0);
});
test("unsaved monitoring edits block destructive reload and visit switching",async({page})=>{
 const s=await setup(page,{multiple:true}),confirmations=[];page.on("dialog",async dialog=>{confirmations.push(dialog.message());await dialog.dismiss();});await active(page).getByLabel("Height (cm)").fill("127");
 await page.getByRole("button",{name:"Reload visit",exact:true}).click();
 await expect(active(page).getByLabel("Height (cm)")).toHaveValue("127");
 await expect(modal(page).getByRole("alert")).toContainText("Save your draft");
 await expect(page.getByRole("combobox",{name:"Verified Planting Report",exact:true})).toBeEnabled();
 await page.getByRole("combobox",{name:"Verified Planting Report",exact:true}).selectOption(visitId+"-SECOND");
 await expect(page.getByRole("combobox",{name:"Verified Planting Report",exact:true})).toHaveValue(visitId);expect(confirmations).toHaveLength(2);expect(s.reads.some(([,path])=>path.endsWith("-SECOND"))).toBe(false);
 await page.getByRole("button",{name:"Close monitoring visit"}).click();await page.getByRole("button",{name:visitId,exact:true}).click();await expect(active(page).getByLabel("Height (cm)")).toHaveValue("127");
 await page.getByRole("button",{name:"Save TREE-A Draft"}).click();await expect(page.getByText(/Draft · Revision 5/)).toBeVisible();await expect(page.getByRole("combobox",{name:"Verified Planting Report",exact:true})).toBeEnabled();expect(s.puts).toHaveLength(1);
});

test("unsent tree clarification survives collapse and canceled reload without blocking draft save",async({page})=>{
 const s=await setup(page);await tree(page,"TREE-B");await active(page).getByRole("radio",{name:"Needs Rechecking",exact:true}).check();await active(page).getByLabel("Assessment Remarks *").fill("Recheck the field tag");await page.getByRole("button",{name:"Save TREE-B Draft"}).click();
 await page.getByLabel("Request additional information from Requester").check();await active(page).getByLabel("Question to the verified planting requester").fill("Was the tag moved?");
 const button=page.locator(".psm-tree-list button").filter({hasText:"TREE-B"});await button.click();await button.click();await expect(active(page).getByLabel("Question to the verified planting requester")).toHaveValue("Was the tag moved?");
 await page.getByRole("button",{name:"Reload visit",exact:true}).click();await expect(active(page).getByLabel("Question to the verified planting requester")).toHaveValue("Was the tag moved?");
 await page.getByRole("button",{name:"Save TREE-B Draft"}).click();await expect(page.getByText(/Draft · Revision 6/)).toBeVisible();await expect(active(page).getByLabel("Question to the verified planting requester")).toHaveValue("Was the tag moved?");expect(s.questions).toHaveLength(0);
 await page.getByRole("button",{name:"Submit Visit",exact:true}).click();await expect(modal(page).getByRole("alert")).toContainText("unsent requester question");expect(s.puts).toHaveLength(2);
 await active(page).getByRole("radio",{name:"Healthy",exact:true}).check();await page.getByRole("button",{name:"Discard unsent question for TREE-B",exact:true}).click();await page.getByRole("button",{name:"Submit Visit",exact:true}).click();await expect(page.getByText(/Pending Admin Review · Revision 7/)).toBeVisible();expect(s.puts).toHaveLength(3);
});

test("changing away from rechecking clears obsolete conditional field errors",async({page})=>{
 const s=await setup(page);await tree(page,"TREE-B");await active(page).getByRole("radio",{name:"Needs Rechecking",exact:true}).check();await page.getByRole("button",{name:"Save TREE-B Draft"}).click();
 await expect(active(page).getByLabel("Assessment Remarks *")).toHaveAttribute("aria-invalid","true");
 await active(page).getByRole("radio",{name:"Healthy",exact:true}).check();await expect(active(page).getByLabel("Remarks",{exact:true})).toHaveAttribute("aria-invalid","false");
 await page.getByRole("button",{name:"Save TREE-B Draft"}).click();await expect(page.getByText(/Draft · Revision 5/)).toBeVisible();expect(s.puts).toHaveLength(1);
});


test("each tree explains why existing-photo uploads are unavailable without disabling Take Photo", async ({ page }) => {
  const state = await setup(page);
  for (const id of ["TREE-A", "TREE-B"]) {
    await tree(page, id);
    const upload = active(page).getByRole("button", { name: "Upload Existing Photo", exact: true });
    await expect(upload).toBeDisabled();
    await expect(upload).toHaveAttribute("aria-describedby", `sample-${id}-original-policy`);
    await expect(active(page).locator(`[id="sample-${id}-original-policy"]`)).toContainText("MENRO approval");
    await expect(active(page).locator(`[id="sample-${id}-original-policy"]`)).toContainText("Use Take Photo");
    await expect(active(page).getByRole("button", { name: `Capture verified photo for ${id}` })).toBeEnabled();
    await expect(active(page).locator('input[type="file"]')).toHaveCount(0);
  }
  expect(state.uploads).toHaveLength(0);
  expect(state.unregistered).toEqual([]);
});

test("blueprint header, authoritative context and schedule fallbacks show no internal identifiers", async ({ page }) => {
  await setup(page, { noSchedule: true });
  const dialog = modal(page);
  await expect(dialog.locator(".psm-header svg").first()).toBeVisible();
  await expect(dialog.locator(".psm-status-badge")).toHaveText("Draft");
  await expect(dialog.getByRole("button", { name: "Close monitoring visit" })).toBeVisible();
  await expect(dialog.getByText("Narra: 30 planted", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Molave: quantity not recorded", { exact: true })).toBeVisible();
  await expect(dialog.locator(".psm-section").first().getByText("Monitoring Visit Number", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Pending Official Schedule", { exact: true })).toHaveCount(3);
  await expect(dialog.getByText("Draft · Revision 4", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: visitId })).toHaveCount(0);
  await expect(dialog.getByText(/version \d/)).toHaveCount(0);
  await expect(dialog.getByText("DRAFT", { exact: true })).toHaveCount(0);
});

test("progress cards do not overlap, tree rows show prior state, and conditions are radio choices", async ({ page }) => {
  const s = await setup(page);
  const cards = page.locator(".psm-progress-card");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText("Assessed"); await expect(cards.nth(0)).toContainText("1");
  await expect(cards.nth(1)).toContainText("Needs Rechecking"); await expect(cards.nth(1)).toContainText("0");
  await expect(cards.nth(2)).toContainText("Not Assessed"); await expect(cards.nth(2)).toContainText("1");
  await expect(page.getByText("1 / 2 confirmed", { exact: true })).toBeVisible();
  const rowB = page.locator(".psm-tree-list button").filter({ hasText: "TREE-B" });
  await expect(rowB).toContainText("Narra"); await expect(rowB).toContainText("Not Assessed"); await expect(rowB).toContainText("Previous: Healthy");
  const group = active(page).getByRole("radiogroup", { name: "Tree Condition *" });
  for (const value of ["Healthy", "Damaged", "Dead", "Needs Rechecking"]) await expect(group.getByRole("radio", { name: value, exact: true })).toBeVisible();
  await expect(group.getByRole("radio", { name: "Healthy", exact: true })).toBeChecked();
  await tree(page, "TREE-B");
  await active(page).getByRole("radio", { name: "Needs Rechecking", exact: true }).check();
  await expect(cards.nth(1)).toContainText("1"); await expect(cards.nth(2)).toContainText("0");
  await expect(page.getByText("2/2 assessments recorded; 1 needs rechecking.", { exact: true })).toBeVisible();
  const recheck = active(page).locator(".psm-rechecking");
  await expect(recheck.getByText("Yes — Needs Rechecking", { exact: true })).toBeVisible();
  await expect(recheck.getByText("Enter the reason in Assessment Remarks.", { exact: true })).toBeVisible();
  await active(page).getByLabel("Assessment Remarks *").fill("Leaves wilting near tag");
  await expect(recheck.getByText("Leaves wilting near tag", { exact: true })).toBeVisible();
  await expect(recheck.getByText("2026-12-01", { exact: true })).toBeVisible();
  const summary = page.locator(".psm-summary");
  await expect(summary).toContainText("Assessment Completion Count"); await expect(summary).toContainText("1 / 2");
  await expect(summary).toContainText("Needs Rechecking");
  await active(page).getByRole("radio", { name: "Dead", exact: true }).check();
  await expect(cards.nth(0)).toContainText("2"); await expect(active(page).locator(".psm-rechecking")).toHaveCount(0);
  expect(s.puts).toHaveLength(0); expect(s.unregistered).toEqual([]);
});

test("condition radios submit the exact backend vocabulary", async ({ page }) => {
  const s = await setup(page);
  await tree(page, "TREE-B");
  await active(page).getByRole("radio", { name: "Damaged", exact: true }).check();
  await page.getByRole("button", { name: "Submit Visit", exact: true }).click();
  await expect(page.getByText("Pending Admin Review · Revision 5", { exact: true })).toBeVisible();
  expect(s.puts[0].assessments.map(row => row.condition)).toEqual(["Healthy", "Damaged"]);
  expect(s.puts[0].submit).toBe(true);
});

test("sampling plan status in Section 1 is shown as a readable label, never a raw backend code", async ({ page }) => {
  await setup(page);
  const section = modal(page).locator(".psm-section").first();
  const status = section.locator("div").filter({ has: page.getByText("Sampling Plan Status", { exact: true }) }).locator("dd");
  await expect(status).toHaveText("Approved");
  await expect(section.getByText("APPROVED", { exact: true })).toHaveCount(0);
});
