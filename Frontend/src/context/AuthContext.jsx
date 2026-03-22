import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // get token from localStorage (or cookies)
    const token = localStorage.getItem("token");

    if (token) {
      try {
        // decode JWT (basic decode without library)
        const payload = JSON.parse(atob(token.split(".")[1]));

        setUser({
          name: payload.name,
          email: payload.email,
        });
      } catch (err) {
        console.error("Invalid token");
        setUser(null);
      }
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// custom hook
export const useAuth = () => useContext(AuthContext);