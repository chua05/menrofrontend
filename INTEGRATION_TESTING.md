# Local Monitoring Phase 2 integration testing (Windows 11)

These commands are emulator-only. Keep the real `.firebaserc` default unchanged and always pass the demo project explicitly.

```powershell
$env:FIREBASE_CLI_DISABLE_UPDATE_CHECK='true'
$env:MENRO_INTEGRATION_TEST='true'
$env:GCLOUD_PROJECT='demo-menro-phase2'
$env:FIREBASE_PROJECT_ID='demo-menro-phase2'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
$env:MENRO_UPLOAD_ROOT=Join-Path $env:TEMP 'menro-phase2-uploads'

cd C:\Users\chuak\Desktop\menrobackend
npm run test:integration:safety

cd C:\Users\chuak\Desktop\menrosystem
npm run test:integration:safety
firebase emulators:start --project demo-menro-phase2 --only auth,firestore
```

In separate PowerShell windows with the same backend variables, run `npm run integration:seed`, then start the backend. Start the frontend with values from `.env.integration.example`, then run `npm run test:e2e`. Run `npm run integration:cleanup` before stopping the emulators. Never omit `--project demo-menro-phase2`.
