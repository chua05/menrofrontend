import "../styles/startup.css";

export default function AuthLoading() {
  return <section className="startup-panel" role="status" aria-live="polite"><h1>Checking your sign-in</h1><p>Please wait while MENRO restores and verifies your session. If this takes longer than expected, reload the page.</p><a href="">Reload page</a></section>;
}
