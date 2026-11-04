import { useEffect, useRef, useState } from "react";
import { sampleRequest } from "../services/permanentSampleApi";

export default function MonitoringInformationPanel({ visitId, readOnly = false }) {
  const [rows, setRows] = useState([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const attempt = useRef(null);
  useEffect(() => {
    let active = true;
    sampleRequest(`/sample-monitoring-information?paged=true&visitId=${encodeURIComponent(visitId)}`)
      .then(data => { if (active) { setRows(data.requests); setCursor(data.nextCursor); } })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [visitId]);
  async function more() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await sampleRequest(`/sample-monitoring-information?paged=true&visitId=${encodeURIComponent(visitId)}&cursor=${encodeURIComponent(cursor)}`);
      setRows(previous => [...new Map([...previous, ...data.requests].map(row => [row.id, row])).values()]);
      setCursor(data.nextCursor);
    } catch (error) { setError(error.message); }
    finally { setLoadingMore(false); }
  }
  async function send(event) {
    event.preventDefault();
    if (busy || !question.trim()) return;
    setBusy(true); setError("");
    const value = question.trim();
    if (attempt.current?.question !== value) attempt.current = { question: value, key: crypto.randomUUID() };
    try {
      const row = await sampleRequest("/sample-monitoring-information", { method: "POST", headers: {
        "Content-Type": "application/json", "Idempotency-Key": attempt.current.key,
      }, body: JSON.stringify({ visitId, question: value }) });
      setRows(previous => [row, ...previous.filter(item => item.id !== row.id)]);
      setQuestion(""); attempt.current = null;
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <section className="mt-6 rounded-xl border bg-white p-4" aria-label="Optional requester information">
    <h3 className="text-lg font-semibold">Requester information</h3>
    <p>Optional. Unanswered questions do not block assessments, submission or review.</p>
    {loading && <p role="status">Loading information requests…</p>}
    {error && <p role="alert">{error}</p>}
    {!readOnly && <form onSubmit={send} className="my-3 space-y-2">
      <label className="block">Question to the verified planting requester
        <textarea required maxLength={2000} value={question} onChange={e => setQuestion(e.target.value)} className="block w-full rounded border p-2" />
      </label>
      <button disabled={busy || !question.trim()} className="rounded bg-emerald-700 px-4 py-2 text-white">{busy ? "Sending…" : "Request Information"}</button>
    </form>}
    {!loading && !rows.length && <p>No information requests.</p>}
    <ul className="space-y-3">{rows.map(row => <li key={row.id} className="rounded border p-3">
      <p>{row.question}</p><p>Status: {row.status}</p>
      {row.answer && <p>Reply: {row.answer}</p>}
      <ol>{row.history.map((entry, i) => <li key={i}>{entry.action} · {entry.role}</li>)}</ol>
    </li>)}</ul>
    {cursor && <button disabled={loadingMore} onClick={more}>{loadingMore ? "Loading older requests…" : "Load older requests"}</button>}
  </section>;
}
