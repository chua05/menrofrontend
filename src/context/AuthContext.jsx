import { createContext, useContext, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const storedUser = JSON.parse(localStorage.getItem("user"));

  const [currentUser, setCurrentUser] = useState(storedUser);
  const [userRole, setUserRole] = useState(storedUser?.role || null);

  const login = (user, role) => {
    const resolvedRole = role || user.role || "volunteer";
    const userWithRole = { ...user, role: resolvedRole };

    localStorage.setItem("user", JSON.stringify(userWithRole));
    setCurrentUser(userWithRole);
    setUserRole(resolvedRole);
  };

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    setCurrentUser(null);
    setUserRole(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, userRole, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}