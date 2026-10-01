/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import { authenticatedFetch } from "../services/authenticatedApi";
import { normalizeRole } from "../utils/roleRoutes";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const authRevision = useRef(0);

  useEffect(() => {
    // Remove credentials/profile state written by older frontend versions.
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("profile");

    return onAuthStateChanged(auth, async (firebaseUser) => {
      const revision = ++authRevision.current;

      if (!firebaseUser) {
        if (revision !== authRevision.current) return;
        setCurrentUser(null);
        setUserRole(null);
        setAuthLoading(false);
        return;
      }

      try {
        const response = await authenticatedFetch("/auth/profile");
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.data) throw new Error("Unable to restore session.");
        if (revision !== authRevision.current) return;
        const resolvedRole = normalizeRole(payload.data.role);
        setCurrentUser({ ...payload.data, role: resolvedRole });
        setUserRole(resolvedRole);
      } catch {
        if (revision !== authRevision.current) return;
        setCurrentUser(null);
        setUserRole(null);
      } finally {
        if (revision === authRevision.current) setAuthLoading(false);
      }
    });
  }, []);

  const login = (user, role) => {
    // A profile restore can start as soon as Firebase reports the sign-in.
    // Invalidate that request so a late failure cannot erase this verified login.
    authRevision.current += 1;
    const resolvedRole = normalizeRole(role || user.role);
    const userWithRole = { ...user, role: resolvedRole };
    setCurrentUser(userWithRole);
    setUserRole(resolvedRole);
    setAuthLoading(false);
  };

  const logout = async () => {
    authRevision.current += 1;
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
