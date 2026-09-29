/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import { authenticatedFetch } from "../services/authenticatedApi";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // Remove credentials/profile state written by older frontend versions.
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("profile");

    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setCurrentUser(null);
        setUserRole(null);
        setAuthLoading(false);
        return;
      }

      try {
        const response = await authenticatedFetch("/auth/profile");
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.data) throw new Error("Unable to restore session.");
        setCurrentUser(payload.data);
        setUserRole(payload.data.role || "participant");
      } catch {
        setCurrentUser(null);
        setUserRole(null);
      } finally {
        setAuthLoading(false);
      }
    });
  }, []);

  const login = (user, role) => {
    const resolvedRole = role || user.role || "participant";
    const userWithRole = { ...user, role: resolvedRole };
    setCurrentUser(userWithRole);
    setUserRole(resolvedRole);
  };

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("profile");
    setCurrentUser(null);
    setUserRole(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, userRole, authLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
