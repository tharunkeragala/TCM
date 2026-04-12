import { useNavigate } from "react-router";

export default function useLogout() {
  const navigate = useNavigate();

  const logout = () => {
    // Remove tokens
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");

    // Redirect to signin and replace history so back button cannot go back
    navigate("/signin", { replace: true });
  };

  return logout;
}