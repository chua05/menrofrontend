import { test,expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
// Real acceptance for the existing monitoring lifecycles: each MON record opens Monitor Planted Trees for its own verified report.
const frontend="http://127.0.0.1:5186",backend="http://127.0.0.1:5185";
const allowed=new Set([frontend,backend,"http://127.0.0.1:9399","http://127.0.0.1:8381","http://127.0.0.1:9398"]);
const root=process.env.MENRO_MONITORING_ACCEPTANCE_ROOT;
const fixture=async()=>JSON.parse(await readFile(path.join(root,"menro-phase3c-browser-fixture.json"),"utf8"));
const shot=(page,name)=>page.screenshot({path:path.join(root,`lifecycle-${name}.png`),fullPage:true});
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
async function api(page,endpoint,method="GET",body){return page.evaluate(async({endpoint,method,body})=>{const {authenticatedFetch}=await import("/src/services/authenticatedApi.js");const r=await authenticatedFetch(endpoint,{method,...(body?{body:JSON.stringify(body),headers:{"Content-Type":"application/json"}}:{})});return{status:r.status,body:await r.json()};},{endpoint,method,body});}
const detail=(page,id)=>api(page,`/verified-sample-monitoring/visits/${id}`);
const selectTree=async(page,id)=>{const button=page.locator(".psm-tree-list button").filter({hasText:id});if(await button.getAttribute("aria-expanded")!=="true")await button.click();};
const active=page=>page.locator(".psm-tree");
const waitPut=(page,id)=>page.waitForResponse(r=>r.request().method()==="PUT"&&new URL(r.url()).pathname===`/api/verified-sample-monitoring/visits/${id}`);
async function saveTree(page,f){const response=waitPut(page,f.visitId);await page.getByRole("button",{name:"Save Tree Assessment",exact:true}).click();const r=await response;expect(r.status()).toBe(200);return(await r.json()).data;}
async function submit(page,f){const response=waitPut(page,f.visitId);await page.getByRole("button",{name:"Submit Monitoring Visit",exact:true}).click();const r=await response;expect(r.status()).toBe(200);const v=(await r.json()).data;expect(v.status).toBe("PENDING_ADMIN_APPROVAL");await expect(page.getByText(/Pending Admin Review · Revision/)).toBeVisible();return v;}
// Each capture uses its own part of the simulated camera clip: an identical frame is correctly refused as duplicate evidence.
let shots=0;
async function capture(page,tree,latitude){
 const time=0.3+1.5*shots++;
 await selectTree(page,tree);await page.context().setGeolocation({latitude,longitude:123.932983,accuracy:5});
 const created=page.waitForResponse(r=>r.request().method()==="POST"&&new URL(r.url()).pathname==="/api/evidence-capture-sessions");
 await page.getByRole("button",{name:`Capture verified photo for ${tree}`}).click();await page.getByRole("button",{name:/Continue to Camera/}).click();
 const video=page.locator("video.secure-camera-preview");await expect.poll(()=>video.evaluate(v=>v.srcObject instanceof MediaStream&&v.videoWidth>0&&v.videoHeight>0&&v.srcObject.getVideoTracks().some(t=>t.readyState==="live")),{timeout:15000}).toBe(true);
 await expect.poll(()=>video.evaluate(v=>v.currentTime),{timeout:30000,intervals:[50]}).toBeGreaterThan(time);
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

const monthsBack=(value,months)=>{const [y,m,d]=value.split("-").map(Number);const absolute=y*12+m-1-months;const year=Math.floor(absolute/12),month=absolute%12;const last=new Date(Date.UTC(year,month+1,0,12)).getUTCDate();return `${year}-${String(month+1).padStart(2,"0")}-${String(Math.min(d,last)).padStart(2,"0")}`;};
const shown=value=>new Intl.DateTimeFormat("en-PH",{year:"numeric",month:"short",day:"2-digit"}).format(new Date(`${value}T00:00:00`));
const row=(page,mon)=>page.locator(`tr[data-lifecycle-row="${mon}"]`);
async function lifecyclePage(page,role){await page.goto(`/${role}/survival-monitoring`,{waitUntil:"domcontentloaded"});await expect(page.locator("tr[data-lifecycle-row]")).toHaveCount(3,{timeout:60000});}
async function expectRow(page,mon,{start,next,status}){const cells=row(page,mon).locator("td");await expect(cells.nth(3)).toHaveText(start);await expect(cells.nth(4)).toHaveText(next);await expect(cells.nth(5).locator(".sm-status-badge")).toHaveText(status);}
async function reviewVisit(admin,id,approve,reason){
 await lifecyclePage(admin,"admin");await admin.locator(`tr[data-sample-visit-row="${id}"]`).getByRole("button",{name:`View monitoring visit ${id}`,exact:true}).click({timeout:60000});await expect(admin.getByRole("dialog",{name:"Review Monitoring Visit"})).toBeVisible();
 if(!approve)await admin.getByLabel("Return reason").fill(reason);
 const wait=admin.waitForResponse(r=>new URL(r.url()).pathname.endsWith(`/${id}/review`)&&r.request().method()==="POST");await admin.getByRole("button",{name:approve?"Approve Visit":"Return for Correction",exact:true}).click();const response=await wait;expect(response.status()).toBe(200);return(await response.json()).data;
}
test("real existing lifecycles: MON-2026-001, 002 and 003 each run Monitor Planted Trees without a new lifecycle",async({browser})=>{
 test.setTimeout(1500000);
 const staffContext=await browser.newContext(),staff=await staffContext.newPage();await isolate(staff);const f=await login(staff,"staff");
 const adminContext=await browser.newContext(),admin=await adminContext.newPage();await isolate(admin);await login(admin,"admin");
 expect(f.lifecycles.map(item=>[item.monitoringNumber,item.reportNumber])).toEqual([["MON-2026-001","RPT-2026-020"],["MON-2026-002","RPT-2026-024"],["MON-2026-003","RPT-2026-030"]]);
 const today=f.visitDate,first=monthsBack(today,1);
 await lifecyclePage(staff,"staff");
 for(const item of f.lifecycles)await expectRow(staff,item.monitoringNumber,{start:"—",next:"Not Scheduled",status:"Awaiting First Monitoring Visit"});
 await shot(staff,"0-before");
 for(const [index,item] of f.lifecycles.entries())await test.step(`${item.monitoringNumber} / ${item.reportNumber}`,async()=>{
  const ids=Array.from({length:item.quantity/10},(_,n)=>`${item.reportNumber}-T00${n+1}`),dialog=staff.getByRole("dialog",{name:"Monitor Planted Trees"});
  await lifecyclePage(staff,"staff");await row(staff,item.monitoringNumber).getByRole("button",{name:`Start Visit 1 for ${item.monitoringNumber}`,exact:true}).click();
  await expect(dialog.locator("#psm-readiness-selection-title")).toContainText(item.reportNumber,{timeout:30000});
  await expect(shellValue(dialog,"Start Monitoring Date")).toHaveText("—");await expect(shellValue(dialog,"Next Monitoring Date")).toHaveText("Not fixed for Visit 1");await expect(shellValue(dialog,"Automatic 10% Sample Target")).toHaveText(String(ids.length));
  const created=staff.waitForResponse(r=>r.request().method()==="POST"&&new URL(r.url()).pathname===`/api/verified-sample-monitoring/verified-reports/${item.reportId}/first-visit`);
  await dialog.locator('section[aria-labelledby="psm-readiness-selection-title"]').getByRole("button",{name:"Start Visit 1",exact:true}).click();
  const response=await created;expect(response.status()).toBe(201);const visit=(await response.json()).data,v={...f,visitId:visit.id};expect(visit.sampleAssessments.map(entry=>entry.sampleId)).toEqual(ids);
  for(const [n,id] of ids.entries()){
   await capture(staff,id,Number((12.662311+(index*3+n)*0.00002).toFixed(6)));await verifyLocation(staff,id,v);
   await active(staff).getByRole("radio",{name:"Healthy",exact:true}).check();await active(staff).getByLabel("Height (cm)").fill("40");await active(staff).getByLabel("Stem Diameter (mm)").fill("6");await saveTree(staff,v);
  }
  await staff.getByLabel("Date Monitored *",{exact:true}).fill(first);const draft=waitPut(staff,visit.id);await staff.getByRole("button",{name:"Save Draft",exact:true}).click();expect((await draft).status()).toBe(200);
  await lifecyclePage(staff,"staff");await expectRow(staff,item.monitoringNumber,{start:"—",next:"Not Scheduled",status:"Visit 1: Draft"});
  await row(staff,item.monitoringNumber).getByRole("button",{name:`Continue Visit 1 for ${item.monitoringNumber}`,exact:true}).click();await expect(dialog.getByRole("combobox",{name:"Verified Planting Report *",exact:true})).toHaveValue(visit.id,{timeout:30000});
  await expect(staff.getByLabel("Date Monitored *",{exact:true})).toHaveValue(first);await submit(staff,v);
  await lifecyclePage(staff,"staff");await expectRow(staff,item.monitoringNumber,{start:`${shown(first)}Pending Admin Review`,next:"Not Scheduled",status:"Visit 1: Pending Admin Review"});
  await reviewVisit(admin,visit.id,false,"Re-measure the first tree.");
  await lifecyclePage(staff,"staff");await expectRow(staff,item.monitoringNumber,{start:"—",next:"Not Scheduled",status:"Visit 1: Returned for Correction"});
  await row(staff,item.monitoringNumber).getByRole("button",{name:`Continue Visit 1 for ${item.monitoringNumber}`,exact:true}).click();await expect(dialog.getByRole("status",{name:"Returned for Correction"})).toContainText("Re-measure the first tree.",{timeout:30000});
  await selectTree(staff,ids[0]);await active(staff).getByLabel("Height (cm)").fill("41");await saveTree(staff,v);await capture(staff,ids[0],Number((12.662312+index*0.00002).toFixed(6)));await verifyLocation(staff,ids[0],v);await submit(staff,v);
  const approved=await reviewVisit(admin,visit.id,true);expect(approved.status).toBe("APPROVED");
  const due=approved.nextScheduledDueDate;await lifecyclePage(staff,"staff");await expectRow(staff,item.monitoringNumber,{start:shown(first),next:`${shown(due)}Visit 2`,status:due<=today?"Available for Monitoring".replace(/.*/,due<today?"Monitoring Overdue":"Available for Monitoring"):"Next Monitoring Scheduled"});
  expect((await detail(staff,visit.id)).body.data.sampleAssessments.map(entry=>entry.sampleId)).toEqual(ids);
 });
 await shot(staff,"1-after");
 await test.step("Visit 2 opens from the same lifecycle row with the same Tree ID; no lifecycle was added or changed",async()=>{
  const item=f.lifecycles[0];if(monthsBack(today,0)>=monthsBack(first,-1)){
   await row(staff,item.monitoringNumber).getByRole("button",{name:`Start Visit 2 for ${item.monitoringNumber}`,exact:true}).click();const dialog=staff.getByRole("dialog",{name:"Monitor Planted Trees"});await expect(dialog.locator("#psm-readiness-selection-title")).toContainText(item.reportNumber,{timeout:30000});
   await dialog.locator('section[aria-labelledby="psm-readiness-selection-title"]').getByRole("button",{name:"Start Visit 2",exact:true}).click();await expect(dialog.locator(".psm-tree-list button")).toHaveCount(1,{timeout:30000});await expect(dialog.locator(".psm-tree-list")).toContainText(`${item.reportNumber}-T001`);await expect(dialog).toContainText("Previous Height (cm)");
   await lifecyclePage(staff,"staff");await expect(row(staff,item.monitoringNumber).locator(".sm-status-badge")).toHaveText("Visit 2: Draft");await expect(row(staff,item.monitoringNumber).locator("td").nth(3)).toHaveText(shown(first));
  }
  const records=(await api(staff,"/monitoring")).body.data;expect(records.map(record=>[record.monitoringNumber,record.history.length,record.startMonitoringDate]).sort()).toEqual([["MON-2026-001",0,null],["MON-2026-002",0,null],["MON-2026-003",0,null]]);
 });
 await adminContext.close();await staffContext.close();
});
