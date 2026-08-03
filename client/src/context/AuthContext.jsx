import {createContext, useContext, useEffect, useState} from "react";
import {api} from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({children}) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // check if user is already logged in
    api.get("/auth/me")
      .then(res => {
        setUser(res.data);
      })
      .catch(err => {
        // not logged in, that's ok
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", {email, password});
    setUser(res.data);
  }

  const register = async (name, email, password) => {
    const res = await api.post("/auth/register", {name, email, password});
    setUser(res.data);
  }

  const logout = async () => {
    await api.post("/auth/logout");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{user, loading, login, register, logout}}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
