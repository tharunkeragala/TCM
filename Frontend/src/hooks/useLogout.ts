import { useNavigate } from "react-router";

export default function useLogout() {
  const navigate = useNavigate();

  const logout = () => {
    // Remove tokens
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");

    // Redirect to signin and replace history so back button cannot go back
    navigate("/signin", { replace: true });
  };

  return logout;
}