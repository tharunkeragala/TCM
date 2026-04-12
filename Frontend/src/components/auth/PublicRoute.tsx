import type { ReactNode } from "react";
import { Navigate } from "react-router";

interface PublicRouteProps {
  children: ReactNode;
}

export default function PublicRoute({ children }: PublicRouteProps) {
  const token =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token");

  // Redirect logged-in users away from signin/signup
  return token ? <Navigate to="/home" replace /> : children;
}