export function ownsSeedlingRequest(request, user) {
  const uid = user?.uid || user?.id;
  return Boolean(uid && request?.participantId === uid);
}

export function canProcessSeedlingRequest(request, user) {
  const uid = user?.uid || user?.id;
  return Boolean(uid && !ownsSeedlingRequest(request, user) && request?.walkIn?.encodedBy !== uid);
}
