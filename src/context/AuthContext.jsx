import { useState } from "react";
import { AuthContext } from "./authContextValue";

export function AuthProvider({ children }) {
  const storedUser = JSON.parse(localStorage.getItem("user") || "null");

  const [currentUser, setCurrentUser] = useState(storedUser);
  const [userRole, setUserRole] = useState(storedUser?.role || null);

  const login = (user, role, token) => {
    const resolvedRole = role || user.role || "participant";
    const userWithRole = { ...user, role: resolvedRole };

    localStorage.setItem("user", JSON.stringify(userWithRole));
    if (token) localStorage.setItem("token", token);

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

export default AuthProvider;