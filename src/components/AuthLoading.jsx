import "../styles/startup.css";

export default function AuthLoading() {
  return <section className="startup-panel startup-delayed" role="status" aria-live="polite"><h1>Checking your sign-in</h1><p>Please wait while MENRO restores and verifies your session.</p><div className="startup-reload-hint"><p>If this takes longer than expected, reload the page.</p><a href="">Reload page</a></div></section>;
}
