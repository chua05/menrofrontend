/* The real AuthContext module exports both a provider and hook; this mock preserves that API. */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from "react";

const AuthContext = createContext(null);

function fixtureRole() {
  return new URLSearchParams(window.location.search).get("role") || "staff";
}

export function AuthProvider({ children }) {
  const userRole = fixtureRole();
  const currentUser =
    userRole === "unauthenticated"
      ? null
      : { uid: `test-${userRole}`, fullName: "Test User", role: userRole };

  return (
    <AuthContext.Provider value={{ userRole, currentUser, authLoading: false }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return (
    useContext(AuthContext) || {
      userRole: "unauthenticated",
      currentUser: null,
      authLoading: false,
    }
  );
}
