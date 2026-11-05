export * from "../workflows/api.js";
import { auth } from "../workflows/firebase.js";
function signIn() {
  const role = sessionStorage.getItem("fixture-login-role");
  if (!["staff", "admin", "participant"].includes(role)) throw new Error("Unregistered auth fixture");
  const user = { uid: `test-${role}`, role, fullName: "Login fixture", profileComplete: true };
  auth.currentUser = { ...user, providerData: [] };
  // Reproduce the AuthProvider observer restoring a verified session before
  // the interactive login handler finishes. Authorization remains real guards.
  window.dispatchEvent(new CustomEvent("fixture-auth-restored", { detail: user }));
  return { user: auth.currentUser };
}
export const signInWithEmailAndPassword = async () => signIn();
export const startGooglePopup = async () => signIn();
export const sendPasswordResetEmail = async () => {};
export async function verifyMenroSession(user) {
  await new Promise(resolve => requestAnimationFrame(resolve));
  return { uid: user.uid, role: user.role, fullName: "Login fixture", profileComplete: true };
}
