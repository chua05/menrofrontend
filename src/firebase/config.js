import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {

  apiKey: "AIzaSyB28MAsFg7XngyUMV_g3leY3DmQhDgZnnM",

  authDomain: "menrosystem-ddfac.firebaseapp.com",

  projectId: "menrosystem-ddfac",

  storageBucket: "menrosystem-ddfac.firebasestorage.app",

  messagingSenderId: "290555801876",

  appId: "1:290555801876:web:edb33bea8e078ce82d1201"

};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export default app;