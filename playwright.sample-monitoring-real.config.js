import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Buffer } from "node:buffer";
import { existsSync,readFileSync,writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";
const frontend=path.dirname(fileURLToPath(import.meta.url)),root=process.env.MENRO_MONITORING_ACCEPTANCE_ROOT;
assert.ok(root && process.env.MENRO_SAMPLE_MONITORING_FORM_ACCEPTANCE==="true");
const snapshot=JSON.parse(readFileSync(path.join(root,"before.json"),"utf8"));
assert.equal(path.resolve(snapshot.frontend.root),frontend);
const backend=path.resolve(process.env.MENRO_MONITORING_BACKEND_WORKTREE || path.join(frontend,"..","menro-kyla-backend"));
assert.equal(backend,path.resolve(snapshot.backend.root));
for(const key of ["GOOGLE_APPLICATION_CREDENTIALS","FIREBASE_PRIVATE_KEY","FIREBASE_CLIENT_EMAIL","FIREBASE_CONFIG"])assert.equal(process.env[key],undefined);
assert.equal(existsSync(path.join(root,".env")),false);
const video=path.join(root,"owned-camera.y4m"),width=320,height=240,chroma=Buffer.alloc(width*height/4,128);
if(!existsSync(video))writeFileSync(video,Buffer.concat([Buffer.from(`YUV4MPEG2 W${width} H${height} F30:1 Ip A0:0 C420jpeg\n`),...Array.from({length:120},()=>Buffer.concat([Buffer.from("FRAME\n"),randomBytes(width*height),chroma,chroma]))]));
const quote=p=>{assert.match(p,/^[a-zA-Z0-9:/\\._ -]+$/);return `"${p}"`;};
export default defineConfig({testDir:"./tests/e2e",testMatch:process.env.MENRO_MONITORING_ORIGINAL_PHOTO_PROPOSAL === "true" ? "sample-monitoring-original-real.spec.js" : "sample-monitoring-real.spec.js",workers:1,timeout:90000,
 outputDir:path.join(root,"browser-results"),globalTeardown:"./tests/monitoring-real/teardown.js",
 use:{baseURL:"http://127.0.0.1:5186",geolocation:{latitude:12.662301,longitude:123.932983,accuracy:5},trace:"off",
  launchOptions:{args:["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream",`--use-file-for-fake-video-capture=${video}`]}},
 webServer:[{command:`node ${quote(path.join(backend,"tests/integration/phase3cBrowserServer.js"))}`,cwd:root,url:"http://127.0.0.1:5185/",reuseExistingServer:false,timeout:60000},
 {command:"node node_modules/vite/bin/vite.js --config vite.sample-monitoring-real.config.js --host 127.0.0.1 --port 5186",cwd:frontend,url:"http://127.0.0.1:5186",reuseExistingServer:false,timeout:60000}]
});
