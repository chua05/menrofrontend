import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase/config";
import { waitForGooglePopupCompletion } from "../utils/googlePopupRecovery";

// Firebase can leave the opener pending when an embedded browser hands the
// provider callback to another browser context. This does not cancel Firebase
// or retry the sign-in; it only returns MENRO to a usable state.
export const startGooglePopup = () =>
  waitForGooglePopupCompletion(signInWithPopup(auth, googleProvider));
