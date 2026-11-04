import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { sampleRequest } from "../services/permanentSampleApi";

export default function MonitoringInformationPage() {
  const { userRole } = useAuth();
  const [params] = useSearchParams();
  const id = params.get("request");
  const [rows, setRows] = useState(null);
  const [selected, setSelected] = useState(null);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const attempt = useRef(null);
  useEffect(() => {
    let active = true;
    const path = id ? `/sample-monitoring-information/${encodeURIComponent(id)}` : "/sample-monitoring-information";
    sampleRequest(path).then(data => {
      if (!active) return;
      setRows(id ? [data] : data);
      if (id) setSelected(data);
    }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [id]);
  async function reply(event) {
    event.preventDefault();
    if (!answer.trim() || busy) return;
    setBusy(true); setError("");
    const value = answer.trim();
    if (attempt.current?.answer !== value || attempt.current?.id !== selected.id) attempt.current = { id: selected.id, answer: value, key: crypto.randomUUID() };
    try {
      const updated = await sampleRequest(`/sample-monitoring-information/${encodeURIComponent(selected.id)}/answer`, {
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": attempt.current.key },
        body: JSON.stringify({ answer: value, expectedVersion: selected.version }),
      });
      setRows(previous => previous.map(row => row.id === updated.id ? updated : row));
      setSelected(updated); setAnswer(""); attempt.current = null;
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <main className="space-y-4 p-4">
    <h1 className="text-2xl font-semibold">Monitoring information requests</h1>
    <p>Replies provide optional information to MENRO. Private monitoring photos are not shared here.</p>
    {error && <p role="alert">{error}</p>}
    {!rows && !error && <p role="status">Loading requests…</p>}
    {rows?.length === 0 && <p>No information requests.</p>}
    <ul>{rows?.map(row => <li key={row.id} className="my-2 rounded border bg-white p-4">
      <p>{row.question}</p><p>{row.status}</p>{row.answer && <p>Reply: {row.answer}</p>}
      <button onClick={() => { setSelected(row); setAnswer(""); }} className="text-emerald-800 underline">{userRole === "participant" && row.status === "OPEN" ? "Answer This" : "View history"}</button>
    </li>)}</ul>
    {selected && <div role="dialog" aria-modal="true" aria-label="Monitoring information reply" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded bg-white p-5">
        <h2 className="text-xl font-semibold">Monitoring information</h2><p>{selected.question}</p>
        <ol>{selected.history.map((entry, i) => <li key={i}>{entry.action} · {entry.role}</li>)}</ol>
        {selected.answer ? <p>Reply: {selected.answer}</p> : userRole === "participant" && <form onSubmit={reply}>
          <label>Your answer<textarea required maxLength={4000} value={answer} onChange={e => setAnswer(e.target.value)} className="block w-full rounded border p-2" /></label>
          <button disabled={busy || !answer.trim()} className="my-3 rounded bg-emerald-700 p-2 text-white">{busy ? "Sending…" : "Send answer"}</button>
        </form>}
        {error && <p role="alert">{error}</p>}
        <button disabled={busy} onClick={() => setSelected(null)}>Close</button>
      </div>
    </div>}
  </main>;
}
