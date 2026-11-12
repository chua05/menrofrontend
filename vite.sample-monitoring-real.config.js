import assert from "node:assert/strict";
import process from "node:process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
const root=process.env.MENRO_MONITORING_ACCEPTANCE_ROOT;
assert.ok(root && process.env.MENRO_SAMPLE_MONITORING_FORM_ACCEPTANCE === "true", "Run through the credential-free monitoring acceptance launcher.");
const value=JSON.stringify;
const project="demo-menro-legacy-monitoring-20261106";
export default defineConfig({mode:"test",envDir:root,cacheDir:`${root}/vite-cache`,plugins:[react(),tailwindcss()],define:{
 "import.meta.env.VITE_MONITORING_ORIGINAL_PHOTO_PROPOSAL":value(process.env.MENRO_MONITORING_ORIGINAL_PHOTO_PROPOSAL === "true" ? "true" : "false"),
 "import.meta.env.VITE_USE_FIREBASE_EMULATORS":value("true"),"import.meta.env.VITE_SAMPLE_MONITORING_FORM_ACCEPTANCE":value("true"),
 "import.meta.env.VITE_PHASE3C_BROWSER_ACCEPTANCE":value("true"),"import.meta.env.VITE_FIREBASE_PROJECT_ID":value(project),
 "import.meta.env.VITE_FIREBASE_API_KEY":value("demo-key"),"import.meta.env.VITE_FIREBASE_AUTH_DOMAIN":value(`${project}.firebaseapp.com`),
 "import.meta.env.VITE_FIREBASE_STORAGE_BUCKET":value(`${project}.firebasestorage.app`),"import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID":value("000000000000"),
 "import.meta.env.VITE_FIREBASE_APP_ID":value("1:000000000000:web:monitoring-form-acceptance"),"import.meta.env.VITE_API_URL":value("http://127.0.0.1:5185/api"),
 "import.meta.env.VITE_PHASE3C_AUTH_EMULATOR_URL":value("http://127.0.0.1:9399"),"import.meta.env.VITE_PHASE3C_FIRESTORE_EMULATOR_HOST":value("127.0.0.1:8381"),
 "import.meta.env.VITE_PHASE3C_STORAGE_EMULATOR_HOST":value("127.0.0.1:9398"),"import.meta.env.VITE_VERIFIED_PLANTING_COHORT_ENABLED":value("true"),
 "import.meta.env.VITE_MONITORING_INFORMATION_ENABLED":value("true"),"import.meta.env.VITE_FIREBASE_SAME_ORIGIN_AUTH_HELPER":value("false"),
},server:{host:"127.0.0.1",strictPort:true}});
