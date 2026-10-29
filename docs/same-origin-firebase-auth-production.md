# Same-origin Firebase Auth helper production activation

MENRO keeps the Firebase-hosted Auth domain unless
`VITE_FIREBASE_SAME_ORIGIN_AUTH_HELPER=true` is set during the Vercel build.
When it is set on `menro-xxtt-five.vercel.app`, the client uses that host as
its Firebase `authDomain`, and Vercel transparently proxies `/__/auth/*` to
`https://menrosystem-ddfac.firebaseapp.com/__/auth/*` before the SPA fallback.

## Required manual configuration before enabling the gate

1. In Firebase Authentication for `menrosystem-ddfac`, add
   `menro-xxtt-five.vercel.app` to **Authorized domains** (hostname only).
2. Confirm the Google provider's OAuth client accepts exactly
   `https://menro-xxtt-five.vercel.app/__/auth/handler`. If Firebase manages
   the client, confirm this from the Firebase Console rather than changing an
   unrelated Google OAuth client.
3. In the Vercel production environment, set only
   `VITE_FIREBASE_SAME_ORIGIN_AUTH_HELPER=true`, retaining the current public
   Firebase web configuration values. Redeploy after the variable is saved.
4. Before releasing to users, verify `/__/auth/iframe` and
   `/__/auth/handler` return Firebase helper HTML with HTTP 200, no redirect,
   and no React SPA markup.

The proxy does not bypass Firebase OAuth state validation and cannot transfer
state between Messenger WebView storage and Chrome if Android switches browser
contexts during OAuth. Email/password login and registration do not require
this helper path.

## Rollback

Set `VITE_FIREBASE_SAME_ORIGIN_AUTH_HELPER=false` (or remove it) and redeploy.
This restores the existing Firebase-hosted `authDomain`. Keep the rewrite and
authorized-domain entry until the rollback deployment is verified, then remove
only the additional OAuth redirect URI/domain if MENRO approves cleanup.
