export function ownsSeedlingRequest(request, user) {
  const uid = user?.uid || user?.id;
  return Boolean(uid && request?.participantId === uid);
}
