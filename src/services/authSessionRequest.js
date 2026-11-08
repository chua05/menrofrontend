// Fails a request that never settles, so sign-in cannot wait forever on an
// unresponsive server. The signal lets the caller cancel the stalled fetch.
export function requestWithTimeout(run, {
  timeoutMs,
  timeoutError,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  const controller = new AbortController();
  let timer;
  const timedOut = new Promise((resolve, reject) => {
    timer = setTimer(() => {
      controller.abort();
      reject(timeoutError());
    }, timeoutMs);
  });
  return Promise.race([run(controller.signal), timedOut]).finally(() => clearTimer(timer));
}

export function createAuthSessionRequest(requestSession) {
  let currentRequest = null;

  const verify = (firebaseUser) => {
    if (currentRequest?.uid === firebaseUser.uid) {
      return currentRequest.promise;
    }

    const promise = requestSession(firebaseUser);
    currentRequest = { uid: firebaseUser.uid, promise };
    promise.catch(() => {
      if (currentRequest?.promise === promise) currentRequest = null;
    });
    return promise;
  };

  return {
    verify,
    reset: () => {
      currentRequest = null;
    },
  };
}
