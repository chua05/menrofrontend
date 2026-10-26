$ErrorActionPreference = "Stop"

if ($env:MENRO_INTEGRATION_TEST -ne "true" -or
    $env:MENRO_MPDO_BOUNDARY_ACCEPTANCE -ne "true" -or
    $env:MENRO_TEST_BOUNDARY_SOURCE -ne "mpdo-candidate" -or
    $env:GCLOUD_PROJECT -ne "demo-menro-phase2" -or
    $env:FIRESTORE_EMULATOR_HOST -ne "127.0.0.1:8180") {
  throw "Refusing MPDO map acceptance outside the exact isolated demo environment."
}

node ..\menrobackend\tests\integration\seedEmulator.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npx playwright test --config playwright.mpdo-auth.config.js
exit $LASTEXITCODE
