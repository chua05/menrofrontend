import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase/config";

export const startGooglePopup = () => signInWithPopup(auth, googleProvider);
