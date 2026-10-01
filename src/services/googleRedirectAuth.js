import { getRedirectResult, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { auth, googleProvider } from "../firebase/config";

const GOOGLE_REDIRECT_SOURCE_KEY = "menro.googleRedirectSource";

let redirectResultPromise;

export const startGooglePopup = () => signInWithPopup(auth, googleProvider);

export const startGoogleRedirect = async (source) => {
  window.sessionStorage.setItem(GOOGLE_REDIRECT_SOURCE_KEY, source);

  try {
    await signInWithRedirect(auth, googleProvider);
  } catch (error) {
    window.sessionStorage.removeItem(GOOGLE_REDIRECT_SOURCE_KEY);
    throw error;
  }
};

export const hasPendingGoogleRedirect = (source) =>
  window.sessionStorage.getItem(GOOGLE_REDIRECT_SOURCE_KEY) === source;

export const consumeGoogleRedirectResult = async (source) => {
  if (!redirectResultPromise) {
    redirectResultPromise = getRedirectResult(auth);
  }

  try {
    return await redirectResultPromise;
  } finally {
    if (hasPendingGoogleRedirect(source)) {
      window.sessionStorage.removeItem(GOOGLE_REDIRECT_SOURCE_KEY);
    }
  }
};
