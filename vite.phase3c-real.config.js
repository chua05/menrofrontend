import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
const value = (input) => JSON.stringify(input);
export default defineConfig({ plugins: [react(), tailwindcss()], define: {
  "import.meta.env.VITE_USE_FIREBASE_EMULATORS": value("true"), "import.meta.env.VITE_PHASE3C_BROWSER_ACCEPTANCE": value("true"),
  "import.meta.env.VITE_FIREBASE_PROJECT_ID": value("demo-menro-phase2"), "import.meta.env.VITE_FIREBASE_API_KEY": value("demo-key"),
  "import.meta.env.VITE_FIREBASE_AUTH_DOMAIN": value("demo-menro-phase2.firebaseapp.com"), "import.meta.env.VITE_FIREBASE_STORAGE_BUCKET": value("demo-menro-phase2.firebasestorage.app"),
  "import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID": value("000000000000"), "import.meta.env.VITE_FIREBASE_APP_ID": value("1:000000000000:web:phase3c-browser"),
  "import.meta.env.VITE_API_URL": value("http://127.0.0.1:5185/api"), "import.meta.env.VITE_PHASE3C_AUTH_EMULATOR_URL": value("http://127.0.0.1:9099"),
  "import.meta.env.VITE_PHASE3C_FIRESTORE_EMULATOR_HOST": value("127.0.0.1:8181"), "import.meta.env.VITE_PHASE3C_STORAGE_EMULATOR_HOST": value("127.0.0.1:9199"),
  "import.meta.env.VITE_VERIFIED_PLANTING_COHORT_ENABLED": value("true"),
}, server: { host: "127.0.0.1", strictPort: true } });
