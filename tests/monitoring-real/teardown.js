import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync,existsSync,writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
export default function teardown(){
 const root=process.env.MENRO_MONITORING_ACCEPTANCE_ROOT;assert.ok(root);assert.equal(process.env.MENRO_SAMPLE_MONITORING_FORM_ACCEPTANCE,"true");
 const filename=path.join(root,"menro-phase3c-browser-fixture.json");if(!existsSync(filename))return;
 const fixture=JSON.parse(readFileSync(filename,"utf8"));assert.equal(fixture.project,"demo-menro-legacy-monitoring-20261106");assert.match(fixture.prefix,/^phase3c-browser-[0-9a-f-]{36}$/);
 const backend=JSON.parse(readFileSync(path.join(root,"before.json"),"utf8")).backend.root;const results=[];
 const audit=spawnSync(process.execPath,[path.join(backend,"tests/integration/sampleMonitoringBrowserAudit.js")],{cwd:root,env:process.env,encoding:"utf8",windowsHide:true,timeout:45000});
 writeFileSync(path.join(root,"private-evidence-audit.log"),audit.stdout+audit.stderr);assert.equal(audit.status,0,"Read-only evidence persistence audit failed");
 for(let pass=0;pass<2;pass++){
  const result=spawnSync(process.execPath,[path.join(backend,"tests/integration/phase3cBrowserCleanup.js"),fixture.prefix],{cwd:root,env:process.env,encoding:"utf8",windowsHide:true,timeout:45000});
  results.push({pass,exit:result.status,output:result.stdout});writeFileSync(path.join(root,"explicit-cleanup.json"),JSON.stringify(results,null,2));assert.equal(result.status,0,result.stderr||"Fixture cleanup failed");
 }
}
