import { randomUUID, randomBytes } from "node:crypto";
import { Buffer } from "node:buffer";
import process from "node:process";
import { writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";
const fakeVideoPath = path.join(os.tmpdir(), `menro-phase3c-fake-camera-${randomUUID()}.y4m`);
const width = 320, height = 240, chroma = Buffer.alloc((width * height) / 4, 128);
const frames = Array.from({ length: 60 }, () => Buffer.concat([Buffer.from("FRAME\n"), randomBytes(width * height), chroma, chroma]));
writeFileSync(fakeVideoPath, Buffer.concat([Buffer.from(`YUV4MPEG2 W${width} H${height} F30:1 Ip A0:0 C420jpeg\n`), ...frames]));
process.env.MENRO_PHASE3C_FAKE_VIDEO_PATH = fakeVideoPath;
export default defineConfig({ testDir: "./tests/e2e", testMatch: "phase3c-real.spec.js", use: { baseURL: "http://127.0.0.1:5186", permissions: ["camera", "geolocation"], geolocation: { latitude: 12.662301, longitude: 123.932983, accuracy: 5 }, launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${fakeVideoPath}`] } }, webServer: [
  { command: "powershell -NoProfile -Command \"$env:NODE_PATH='C:\\Users\\chuak\\Desktop\\menrobackend\\node_modules'; node tests/integration/phase3cBrowserServer.js\"", cwd: "C:/Users/chuak/Desktop/menrobackend-phase3b-per-tree-evidence", url: "http://127.0.0.1:5185/", reuseExistingServer: false },
  { command: "npx vite --config vite.phase3c-real.config.js --host 127.0.0.1 --port 5186", url: "http://127.0.0.1:5186", reuseExistingServer: false },
] });
