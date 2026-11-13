import { Buffer } from "node:buffer";
import { test,expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
const frontend="http://127.0.0.1:5186",backend="http://127.0.0.1:5185";
const allowed=new Set([frontend,backend,"http://127.0.0.1:9399","http://127.0.0.1:8381","http://127.0.0.1:9398"]);
const root=process.env.MENRO_MONITORING_ACCEPTANCE_ROOT;
const fixture=async()=>JSON.parse(await readFile(path.join(root,"menro-phase3c-browser-fixture.json"),"utf8"));
let unexpected=[],errors=[],traffic=[];
test.beforeEach(()=>{unexpected=[];errors=[];traffic=[];});
test.afterEach(async({page},info)=>{const route=new URL(page.url()).pathname;const diagnostic=JSON.stringify({route,unexpectedOrigins:unexpected,pageErrors:errors,traffic});await writeFile(path.join(root,`original-browser-diagnostics-${Date.now()}.json`),diagnostic);await info.attach("sanitized-diagnostics",{body:diagnostic,contentType:"application/json"});expect(unexpected).toEqual([]);expect(errors).toEqual([]);});
async function isolate(page){
 await page.context().grantPermissions(["camera","geolocation"],{origin:frontend});
 page.on("pageerror",error=>errors.push(error.message));
 page.on("request",request=>{const u=new URL(request.url());if(allowed.has(u.origin)&&u.pathname.startsWith("/api/"))traffic.push({method:request.method(),path:u.pathname,phase:"requested"});});
 page.on("response",response=>{const u=new URL(response.url());if(allowed.has(u.origin))traffic.push({method:response.request().method(),path:u.pathname,status:response.status()});});
 page.on("requestfailed",request=>{const u=new URL(request.url());if(allowed.has(u.origin))traffic.push({method:request.method(),path:u.pathname,failed:true});});
 await page.route("**/*",route=>{const origin=new URL(route.request().url()).origin;if(allowed.has(origin))return route.continue();if(/^https:\/\/[abc]\.tile\.openstreetmap\.org$/.test(origin))return route.abort();unexpected.push(origin);return route.abort();});
}
const urlFor=role=>`/${role==="otherStaff"?"staff":role}/permanent-sample-monitoring`;
async function login(page,role){
 const f=await fixture();await page.goto(urlFor(role),{waitUntil:"domcontentloaded"});await expect(page.locator("#login-email")).toBeVisible({timeout:20000});
 await page.locator("#login-email").fill(f.emails[role]);await page.locator("#login-password").fill(f.password);await page.locator("button.login-primary-btn").click();
 await expect(page).toHaveURL(new RegExp(`/${role==="otherStaff"?"staff":role}/dashboard$`),{timeout:30000});return f;
}
const collection=page=>page.waitForResponse(r=>{const u=new URL(r.url());return r.request().method()==="GET"&&u.origin===backend&&u.pathname==="/api/verified-sample-monitoring/visits";},{timeout:30000});
async function discover(page,role="staff"){await page.getByRole("button",{name:"Open sidebar",exact:true}).click();
 if(role==="admin"){const [response]=await Promise.all([collection(page),page.getByRole("link",{name:"Permanent Sample Monitoring",exact:true}).click()]);return response;}
 // Staff reach permanent-sample monitoring only through Survival Monitoring's single submission button.
 await page.getByRole("link",{name:"Survival Monitoring",exact:true}).click();await expect(page.getByRole("heading",{name:"Survival Monitoring",exact:true})).toBeVisible({timeout:30000});
 const [response]=await Promise.all([collection(page),page.locator(".sm-header-actions").getByRole("button",{name:"Submit Aggregate Monitoring Record",exact:true}).click()]);
 await expect(page.getByRole("dialog",{name:"Monitor Planted Trees"})).toBeVisible();return response;}
async function open(page,role){const f=await login(page,role);const r=await discover(page,role);const b=await r.json();expect(r.status()).toBe(200);expect(b.data.visits.some(v=>v.id===f.visitId)).toBe(true);if(role==="admin")await page.getByRole("button",{name:f.visitId,exact:true}).click();const dialog=page.getByRole("dialog",{name:"Monitor Planted Trees"});await expect(dialog).toBeVisible();await expect(dialog.getByRole("combobox",{name:"Verified Planting Report",exact:true})).toHaveValue(f.visitId);return f;}
async function api(page,endpoint,method="GET",body){return page.evaluate(async({endpoint,method,body})=>{const {authenticatedFetch}=await import("/src/services/authenticatedApi.js");const r=await authenticatedFetch(endpoint,{method,...(body?{body:JSON.stringify(body),headers:{"Content-Type":"application/json"}}:{})});return{status:r.status,body:await r.json()};},{endpoint,method,body});}
const detail=(page,id)=>api(page,`/verified-sample-monitoring/visits/${id}`);
const selectTree=async(page,id)=>{const button=page.locator(".psm-tree-list button").filter({hasText:id});if(await button.getAttribute("aria-expanded")!=="true")await button.click();};
const active=page=>page.locator(".psm-tree");
const waitPut=(page,id)=>page.waitForResponse(r=>r.request().method()==="PUT"&&new URL(r.url()).pathname===`/api/verified-sample-monitoring/visits/${id}`);
async function save(page,f,tree){const response=waitPut(page,f.visitId);await page.getByRole("button",{name:`Save ${tree} Draft`,exact:true}).click();const r=await response;expect(r.status()).toBe(200);return(await r.json()).data;}
async function submit(page,f){const response=waitPut(page,f.visitId);await page.getByRole("button",{name:"Submit Visit",exact:true}).click();const r=await response;expect(r.status()).toBe(200);const v=(await r.json()).data;expect(v.status).toBe("PENDING_ADMIN_APPROVAL");await expect(page.getByText(/Pending Admin Review · Revision/)).toBeVisible();return v;}
test("local proposed originals: per-tree selection, EXIF validation, private upload, Return, correction and explicit Admin approval",async({browser},info)=>{
 test.setTimeout(240000);
 const staffContext=await browser.newContext(),staff=await staffContext.newPage();await isolate(staff);const f=await open(staff,"staff");
 for(const id of f.sampleIds){await selectTree(staff,id);await active(staff).getByRole("radio",{name:"Healthy",exact:true}).check();await active(staff).getByLabel("Height (cm)").fill("120");await active(staff).getByLabel("Diameter (cm)").fill("5");await active(staff).getByLabel("Remarks").fill("Original photo field assessment");}
 await save(staff,f,"TREE-002");
 const originals=JSON.parse(await readFile(path.join(root,"proposal-originals.json"),"utf8"));
 async function choose(tree,key){await selectTree(staff,tree);await expect(staff.getByRole("button",{name:"Upload Existing Photo",exact:true})).toBeEnabled();await staff.locator(`[id="sample-${tree}-original-file"]`).setInputFiles({name:key+".jpg",mimeType:"image/jpeg",buffer:Buffer.from(originals[key])});await expect(staff.getByAltText(`Original photo preview for ${tree}`)).toBeVisible();}
 async function verifyUpload(tree,success=true,loseResponse=false){const wait=staff.waitForResponse(r=>r.request().method()==="POST"&&new URL(r.url()).pathname===`/api/verified-sample-monitoring/visits/${f.visitId}/samples/${tree}/original-photo/verify`);const uploaded=success&&!loseResponse?staff.waitForResponse(r=>r.request().method()==="PUT"&&new URL(r.url()).pathname.endsWith(`/samples/${tree}/evidence`)):null;await staff.getByRole("button",{name:`Verify and upload original photo for ${tree}`}).click();const r=await wait,b=await r.json();if(!success)return{r,b};expect(r.status(),JSON.stringify(b)).toBe(200);expect(b.data.location.accuracyMeters).toBeNull();expect(b.data.verificationStatus).toBe("NEEDS_ADMIN_REVIEW");if(loseResponse){
 await expect(active(staff).locator(".psm-location [role=alert]")).toBeVisible();await expect(staff.getByAltText(`Original photo preview for ${tree}`)).toBeVisible();
 const retried=staff.waitForResponse(r=>r.request().method()==="PUT"&&new URL(r.url()).pathname.endsWith(`/samples/${tree}/evidence`));await staff.getByRole("button",{name:`Verify and upload original photo for ${tree}`}).click();expect((await retried).status()).toBe(200);
 }else expect((await uploaded).status()).toBe(200);await expect(staff.getByAltText(`Original photo preview for ${tree}`)).toHaveCount(0);await expect(staff.locator('path[fill="#2563eb"]')).toHaveCount(1);return b.data;}
 await choose("TREE-001","missingGps");let rejected=await verifyUpload("TREE-001",false);expect(rejected.r.status()).toBe(422);expect(rejected.b.code).toBe("ORIGINAL_GPS_INVALID");await expect(active(staff).locator(".psm-location [role=alert]")).toContainText(rejected.b.message);
 await choose("TREE-001","tree1");const preview1=await staff.getByAltText("Original photo preview for TREE-001").getAttribute("src");await choose("TREE-002","tree2");const preview2=await staff.getByAltText("Original photo preview for TREE-002").getAttribute("src");expect(preview1).not.toBe(preview2);await selectTree(staff,"TREE-001");await expect(staff.getByAltText("Original photo preview for TREE-001")).toHaveAttribute("src",preview1);const keys=[];staff.on("request",r=>{if(r.method()==="PUT"&&new URL(r.url()).pathname.endsWith("/samples/TREE-001/evidence"))keys.push(r.headers()["idempotency-key"]);});
 await staff.route(`**/api/verified-sample-monitoring/visits/${f.visitId}/samples/TREE-001/evidence`,async route=>{const response=await route.fetch({maxRedirects:0});expect(response.status()).toBe(200);await route.abort("failed");},{times:1});
 const proof1=await verifyUpload("TREE-001",true,true);expect(keys.length).toBe(2);expect(keys[0]).toBe(keys[1]);await selectTree(staff,"TREE-002");await expect(staff.getByAltText("Original photo preview for TREE-002")).toHaveAttribute("src",preview2);const proof2=await verifyUpload("TREE-002");expect(proof1.location.latitude).not.toBe(proof2.location.latitude);
 let v=(await detail(staff,f.visitId)).body.data;expect(v.sampleAssessments.map(row=>row.evidenceHistory.length)).toEqual([1,1]);expect(v.sampleAssessments[0].evidenceHistory[0].location.latitude).toBeCloseTo(proof1.location.latitude,6);expect(JSON.stringify(v)).not.toMatch(/objectName|privateEvidence|originalVerificationId/);await submit(staff,f);
 const adminContext=await browser.newContext(),admin=await adminContext.newPage();await isolate(admin);await open(admin,"admin");await expect(admin.getByRole("checkbox")).toHaveCount(2);await expect(admin.locator(".psm-content")).toContainText("GPS accuracy Unknown");
 for(const id of f.sampleIds){const row=admin.locator(".psm-content > ul > li").filter({hasText:id});await row.getByRole("button",{name:"View private evidence revision 0",exact:true}).click();await expect(row.getByAltText(`Private evidence for ${id}, revision 0`)).toBeVisible();}
 let response=admin.waitForResponse(r=>r.request().method()==="POST"&&new URL(r.url()).pathname.endsWith(`/${f.visitId}/review`));await admin.getByRole("button",{name:"Approve Visit",exact:true}).click();let reviewResponse=await response;expect(reviewResponse.status()).toBe(400);expect((await reviewResponse.json()).code).toBe("ORIGINAL_ADMIN_REVIEW_REQUIRED");
 await admin.getByLabel("Return reason").fill("Correct TREE-001 measurement; TREE-002 unchanged");response=admin.waitForResponse(r=>r.request().method()==="POST"&&new URL(r.url()).pathname.endsWith(`/${f.visitId}/review`));await admin.getByRole("button",{name:"Return for Correction",exact:true}).click();expect((await(await response).json()).data.status).toBe("RETURNED");
 await staff.getByRole("button",{name:"Reload visit",exact:true}).click();await expect(staff.getByText(/Returned for Correction · Revision/)).toBeVisible();await selectTree(staff,"TREE-001");await active(staff).getByLabel("Height (cm)").fill("125");await save(staff,f,"TREE-001");
 const blocked=waitPut(staff,f.visitId);await staff.getByRole("button",{name:"Submit Visit",exact:true}).click();expect((await blocked).status()).toBe(409);await expect(staff.locator(".psm-error")).toContainText("assessment or monitoring date changed");
 await choose("TREE-001","corrected");await verifyUpload("TREE-001");v=(await detail(staff,f.visitId)).body.data;expect(v.sampleAssessments[0].evidenceHistory.map(e=>e.revision)).toEqual([0,1]);expect(v.sampleAssessments[1].evidenceHistory.map(e=>e.revision)).toEqual([0]);await submit(staff,f);
 await admin.getByRole("button",{name:"Reload visit",exact:true}).click();await expect(admin.getByText(/Pending Admin Review · Revision/)).toBeVisible();await expect(admin.getByRole("checkbox")).toHaveCount(2);for(const cb of await admin.getByRole("checkbox").all())await cb.check();response=admin.waitForResponse(r=>r.request().method()==="POST"&&new URL(r.url()).pathname.endsWith(`/${f.visitId}/review`));await admin.getByRole("button",{name:"Approve Visit",exact:true}).click();reviewResponse=await response;expect(reviewResponse.status()).toBe(200);expect((await reviewResponse.json()).data.status).toBe("APPROVED");
 await staff.getByRole("button",{name:"Reload visit",exact:true}).click();await expect(staff.getByText("Approved visits are read-only.")).toBeVisible();await expect(staff.getByRole("button",{name:"Upload Existing Photo",exact:true})).toHaveCount(0);
 for(const [tree,index]of [["TREE-001",0],["TREE-001",1],["TREE-002",0]]){const row=admin.locator(".psm-content > ul > li").filter({hasText:tree});const button=row.getByRole("button",{name:`View private evidence revision ${index}`,exact:true});if(await button.count())await button.click();await expect(row.getByAltText(`Private evidence for ${tree}, revision ${index}`)).toBeVisible();}
 await expect(admin.locator('img[src*="firebasestorage"],img[src*="storage.googleapis"]')).toHaveCount(0);await admin.screenshot({path:info.outputPath("originals-approved.png"),fullPage:true});await adminContext.close();await staffContext.close();
});
