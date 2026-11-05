// Only coalesce concurrent reads. Never retain a completed private image or
// share a request between authenticated users. Each response stays server-RBAC checked.
const pending = new Map(), queue = [];
let active = 0;
function pump() {
  while (active < 2 && queue.length) {
    const job = queue.shift(); active++;
    Promise.resolve().then(job.load).then(job.resolve, job.reject).finally(() => {
      pending.delete(job.key); active--; pump();
    });
  }
}
export function privateImageRequest(uid, endpoint, load) {
  if (!uid) return Promise.reject(new Error("Authentication is required."));
  const key = JSON.stringify([uid, endpoint]);
  if (pending.has(key)) return pending.get(key);
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  pending.set(key, promise); queue.push({ key, load, resolve, reject }); pump();
  return promise;
}
