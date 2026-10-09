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
