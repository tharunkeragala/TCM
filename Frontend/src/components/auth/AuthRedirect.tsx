import { useEffect } from "react";
import { useNavigate } from "react-router";

export default function AuthRedirect({ children }: any) {
  const navigate = useNavigate();

  useEffect(() => {
    const token =
      localStorage.getItem("token") ||
      sessionStorage.getItem("token");

    if (token) {
      navigate("/home", { replace: true });
    }
  }, []);

  return children;
}