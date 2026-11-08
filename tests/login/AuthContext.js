// Test boundary only. App, LoginPage, GuestOnlyRoute and ProtectedRoute stay real.
import { createContext, createElement, useContext, useEffect, useState } from "react";
import { clearSuccessfulLogin } from "../../src/utils/loginSuccess.js";
const Context = createContext(null);
export function AuthProvider({ children }) {
  const [currentUser, setUser] = useState(() => JSON.parse(sessionStorage.getItem("fixture-session") || "null"));
  useEffect(() => {
    const restored = event => setUser(event.detail);
    window.addEventListener("fixture-auth-restored", restored);
    return () => window.removeEventListener("fixture-auth-restored", restored);
  }, []);
  const login = user => { sessionStorage.setItem("fixture-session", JSON.stringify(user)); setUser(user); };
  const logout = async () => { clearSuccessfulLogin(); sessionStorage.removeItem("fixture-session"); setUser(null); };
  return createElement(Context.Provider, { value: { currentUser, userRole: currentUser?.role, authLoading: sessionStorage.getItem("fixture-auth-loading") === "true", login, logout } }, children);
}
export const useAuth = () => useContext(Context);
